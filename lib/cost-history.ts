import fs from "fs";
import os from "os";
import path from "path";
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
  const encoded = encodeProjectPath(projectPath);
  const cliDir = path.join(os.homedir(), ".claude", "projects", encoded);

  let entries: string[];
  try {
    entries = fs.readdirSync(cliDir) as unknown as string[];
  } catch {
    return [];
  }

  interface FileMeta {
    file: string;
    filePath: string;
    mtimeMs: number;
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
  const recent = candidates.slice(-limit);

  const result = await Promise.all(
    recent.map(async (c) => ({
      file: c.file,
      cost: await sumTranscriptFileCost(c.filePath),
      mtimeMs: c.mtimeMs,
    }))
  );

  return result;
}
