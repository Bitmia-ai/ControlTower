import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { encodeProjectPath } from "./transcript-file-resolver";
import { sumTranscriptFileCost, calculateCostUsd } from "./cost-calculator";
import { mapWithConcurrency } from "./promise-pool";

/**
 * Cap on parallel transcript scans. The history routes can fan out over
 * up to 50 files; without a limit, cold-cache scans stack large transient
 * heap. With the cost cache warm, this limit is effectively a no-op.
 */
const HISTORY_FANOUT_CONCURRENCY = 4;

/** A single session's cost entry. */
export interface SessionCostEntry {
  /** Basename of the transcript file (e.g., "abc-123.jsonl"). */
  file: string;
  /** Cost in USD summed from token usage. */
  cost: number;
  /** mtime in milliseconds since epoch. */
  mtimeMs: number;
}

/**
 * A richer session entry including phase timeline and duration.
 * Strict superset of SessionCostEntry.
 */
export interface SessionHistoryEntry extends SessionCostEntry {
  /** Timestamp the session started, derived from the first JSONL line; falls back to mtimeMs. */
  startedAt: number;
  /** Approximate session duration in ms (mtimeMs - startedAt; 0 when unknown). */
  durationMs: number;
  /** Distinct phase names observed in the session, in encounter order. */
  phases: string[];
}

interface FileMeta {
  file: string;
  filePath: string;
  mtimeMs: number;
}

function listRecentTranscriptFiles(projectPath: string, limit: number): FileMeta[] {
  const encoded = encodeProjectPath(projectPath);
  const cliDir = path.join(os.homedir(), ".claude", "projects", encoded);

  let entries: string[];
  try {
    entries = fs.readdirSync(cliDir) as unknown as string[];
  } catch {
    return [];
  }

  const candidates: FileMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".jsonl")) continue;
    const filePath = path.join(cliDir, entry);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) continue;
      candidates.push({ file: entry, filePath, mtimeMs: stats.mtimeMs });
    } catch {
      // skip unreadable entry
    }
  }

  // Sort ascending by mtime (oldest first), then take last `limit` to keep
  // the most-recent ones, preserving ascending order for chart left-to-right.
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs);
  return candidates.slice(-limit);
}

/**
 * Enumerate per-session costs for a project.
 *
 * Reads `~/.claude/projects/{encoded}/*.jsonl`, sums each via
 * `sumTranscriptFileCost`, sorts ascending by mtime (oldest first),
 * and returns the most-recent `limit` entries (default 10).
 *
 * Returns `[]` if the directory is unreadable. Never throws.
 */
export async function getSessionCostHistory(
  projectPath: string,
  limit = 10
): Promise<SessionCostEntry[]> {
  const recent = listRecentTranscriptFiles(projectPath, limit);

  return mapWithConcurrency(recent, HISTORY_FANOUT_CONCURRENCY, async (c) => ({
    file: c.file,
    cost: await sumTranscriptFileCost(c.filePath),
    mtimeMs: c.mtimeMs,
  }));
}

const PHASE_RE =
  /(?:phase[:\s]+|entering\s+)(TRIAGE|PLAN|BUILD|REVIEW|DEPLOY|VERIFY|MERGE|HARDEN|STABILIZE|INCORPORATE|SCHEDULES)/gi;

function scanContentForPhases(
  content: unknown,
  seen: Set<string>,
  phases: string[]
): void {
  function pushMatches(text: string) {
    PHASE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PHASE_RE.exec(text)) !== null) {
      const phase = m[1].toUpperCase();
      if (!seen.has(phase)) {
        seen.add(phase);
        phases.push(phase);
      }
    }
  }

  if (typeof content === "string") {
    pushMatches(content);
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") pushMatches(text);
      }
    }
  }
}

/**
 * Best-effort scan of a JSONL transcript for phase-change markers.
 *
 * Looks for the pattern `phase: NAME` or `Entering NAME phase` (case-insensitive)
 * across the textual content of each event. Returns distinct phase names in
 * the order they were first observed.
 *
 * Returns `[]` on any error (file missing, malformed lines, etc). Never throws.
 */
export async function extractSessionPhases(filePath: string): Promise<string[]> {
  const phases: string[] = [];
  const seen = new Set<string>();

  let stream: NodeJS.ReadableStream;
  try {
    stream = fs.createReadStream(filePath, { encoding: "utf8" });
  } catch {
    return [];
  }

  try {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object") continue;
      const evt = parsed as { message?: { content?: unknown }; content?: unknown };
      if (evt.message && typeof evt.message === "object") {
        scanContentForPhases((evt.message as { content?: unknown }).content, seen, phases);
      }
      if (evt.content !== undefined) scanContentForPhases(evt.content, seen, phases);
    }
  } catch {
    // Stream errors are silently swallowed — return whatever we collected.
  }

  return phases;
}

/**
 * mtime+size keyed memo for the fused single-pass scan. Old transcripts
 * never change, so cached entries stay valid forever.
 */
interface ScanResult {
  cost: number;
  phases: string[];
  startedAt: number;
}
const MAX_SCAN_CACHE_ENTRIES = 256;
const scanCache = new Map<string, ScanResult>();

function evictOldestScanIfFull(): void {
  while (scanCache.size >= MAX_SCAN_CACHE_ENTRIES) {
    const oldest = scanCache.keys().next().value;
    if (oldest === undefined) return;
    scanCache.delete(oldest);
  }
}

/** Test-only: clear the in-memory scan cache. Not intended for production use. */
export function __resetScanCacheForTests(): void {
  scanCache.clear();
}

interface AssistantUsageEnvelope {
  type?: string;
  message?: { usage?: Parameters<typeof calculateCostUsd>[0] };
}

/**
 * Single-pass scan that yields cost, phases, and the first-line timestamp
 * for a transcript. Replaces three separate full-file streams with one.
 *
 * The result is cached by `${filePath}:${mtimeMs}:${size}`.
 */
async function scanTranscriptOnce(
  filePath: string,
  fallbackTimestampMs: number
): Promise<ScanResult> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return { cost: 0, phases: [], startedAt: fallbackTimestampMs };
  }

  const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  const cached = scanCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const phases: string[] = [];
  const seen = new Set<string>();
  let cost = 0;
  let startedAt: number | null = null;

  let stream: NodeJS.ReadableStream;
  try {
    stream = fs.createReadStream(filePath, { encoding: "utf8" });
  } catch {
    return { cost: 0, phases: [], startedAt: fallbackTimestampMs };
  }

  try {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object") continue;

      if (startedAt === null) {
        const ts = (parsed as { timestamp?: unknown }).timestamp;
        if (typeof ts === "string") {
          const n = Date.parse(ts);
          startedAt = Number.isFinite(n) ? n : fallbackTimestampMs;
        } else if (typeof ts === "number" && Number.isFinite(ts)) {
          startedAt = ts;
        } else {
          startedAt = fallbackTimestampMs;
        }
      }

      const envelope = parsed as AssistantUsageEnvelope;
      if (envelope.type === "assistant" && envelope.message?.usage) {
        cost += calculateCostUsd(envelope.message.usage);
      }

      const evt = parsed as { message?: { content?: unknown }; content?: unknown };
      if (evt.message && typeof evt.message === "object") {
        scanContentForPhases((evt.message as { content?: unknown }).content, seen, phases);
      }
      if (evt.content !== undefined) scanContentForPhases(evt.content, seen, phases);
    }
  } catch {
    // partial result is better than none — fall through with what we have
  }

  const result: ScanResult = {
    cost,
    phases,
    startedAt: startedAt ?? fallbackTimestampMs,
  };
  evictOldestScanIfFull();
  scanCache.set(cacheKey, result);
  return result;
}

/**
 * Enumerate full session history (cost + phases + timing) for a project.
 *
 * Returns sessions sorted ascending by `mtimeMs` (oldest first), capped at `limit`
 * (default 50). Each entry includes the per-session cost, observed phases, and
 * an approximate duration derived from the first-line timestamp (or mtime as fallback).
 *
 * Returns `[]` if the CLI projects directory is unreadable. Never throws.
 *
 * Single-pass per file: cost, phases, and the first-line timestamp are
 * collected by a single `scanTranscriptOnce` stream and cached by
 * mtime+size, so repeat calls on unchanged files return without re-reading.
 */
export async function getSessionHistory(
  projectPath: string,
  limit = 50
): Promise<SessionHistoryEntry[]> {
  const recent = listRecentTranscriptFiles(projectPath, limit);

  return mapWithConcurrency(recent, HISTORY_FANOUT_CONCURRENCY, async (c) => {
    const { cost, phases, startedAt } = await scanTranscriptOnce(c.filePath, c.mtimeMs);
    return {
      file: c.file,
      cost,
      mtimeMs: c.mtimeMs,
      startedAt,
      durationMs: Math.max(0, c.mtimeMs - startedAt),
      phases,
    } satisfies SessionHistoryEntry;
  });
}
