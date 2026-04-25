import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { encodeProjectPath } from "./transcript-file-resolver";
import { sumTranscriptFileCost } from "./cost-calculator";

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

  const result = await Promise.all(
    recent.map(async (c) => ({
      file: c.file,
      cost: await sumTranscriptFileCost(c.filePath),
      mtimeMs: c.mtimeMs,
    }))
  );

  return result;
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
 * Read the first JSONL line and return its timestamp (ms) if parseable.
 * Falls back to `fallback` when no timestamp is found.
 */
async function readFirstLineTimestamp(filePath: string, fallback: number): Promise<number> {
  let stream: NodeJS.ReadableStream;
  try {
    stream = fs.createReadStream(filePath, { encoding: "utf8" });
  } catch {
    return fallback;
  }

  try {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        rl.close();
        return fallback;
      }
      const ts = (parsed as { timestamp?: unknown })?.timestamp;
      if (typeof ts === "string") {
        const n = Date.parse(ts);
        rl.close();
        return Number.isFinite(n) ? n : fallback;
      }
      if (typeof ts === "number" && Number.isFinite(ts)) {
        rl.close();
        return ts;
      }
      rl.close();
      return fallback;
    }
  } catch {
    // fall through
  }
  return fallback;
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
 * KNOWN PERFORMANCE ISSUE (BL-053 review m-1, accepted):
 * Each transcript file is opened and streamed three times per call:
 *   1) `sumTranscriptFileCost` — full scan for token usage
 *   2) `extractSessionPhases` — full scan for phase markers
 *   3) `readFirstLineTimestamp` — opens stream, reads one line, closes
 * For large transcripts this triples I/O. A future optimisation could fuse
 * these into a single pass that yields cost, phases, and the first timestamp
 * together. Deferred: current call sites cap `limit` at 50 and the route
 * is not in a tight hot path; correctness was prioritised over throughput.
 */
export async function getSessionHistory(
  projectPath: string,
  limit = 50
): Promise<SessionHistoryEntry[]> {
  const recent = listRecentTranscriptFiles(projectPath, limit);

  const result = await Promise.all(
    recent.map(async (c) => {
      const [cost, phases, startedAt] = await Promise.all([
        sumTranscriptFileCost(c.filePath),
        extractSessionPhases(c.filePath),
        readFirstLineTimestamp(c.filePath, c.mtimeMs),
      ]);
      const durationMs = Math.max(0, c.mtimeMs - startedAt);
      return {
        file: c.file,
        cost,
        mtimeMs: c.mtimeMs,
        startedAt,
        durationMs,
        phases,
      } satisfies SessionHistoryEntry;
    })
  );

  return result;
}
