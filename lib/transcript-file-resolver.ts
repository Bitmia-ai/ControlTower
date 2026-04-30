import fs from "fs";
import os from "os";
import path from "path";

/** Freshness threshold for .redeye/session-cto.jsonl (60 seconds). */
const REDEYE_FRESHNESS_MS = 60_000;

/**
 * Encode a project path to the format used by the Claude CLI.
 * The CLI stores transcripts at ~/.claude/projects/{encoded-path}/
 * where the encoding replaces all forward slashes with hyphens.
 *
 * Example: "/home/user/control-tower" → "-home-user-control-tower"
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

/**
 * Resolve the best transcript file to tail for a given project path.
 *
 * Priority (per AD-1):
 * 1. .redeye/session-cto.jsonl — if it exists and is < 60s old
 * 2. Most recently modified *.jsonl in ~/.claude/projects/{encoded}/
 * 3. null — no file available (caller should emit keepalives only)
 */
export function resolveTranscriptFile(projectPath: string): string | null {
  // Priority 1: Control Tower session file
  const redeyeFile = path.join(projectPath, ".redeye", "session-cto.jsonl");
  try {
    const stats = fs.statSync(redeyeFile);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs < REDEYE_FRESHNESS_MS) {
      return redeyeFile;
    }
  } catch {
    // File doesn't exist or can't be stat'd — fall through
  }

  // Priority 2: CLI transcript directory
  const encoded = encodeProjectPath(projectPath);
  const cliDir = path.join(os.homedir(), ".claude", "projects", encoded);

  let entries: string[];
  try {
    entries = fs.readdirSync(cliDir) as unknown as string[];
  } catch {
    return null;
  }

  // Filter to *.jsonl files that are not directories, then sort by mtime desc
  interface FileEntry {
    filePath: string;
    mtimeMs: number;
  }

  const jsonlFiles: FileEntry[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".jsonl")) continue;
    const filePath = path.join(cliDir, entry);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) continue;
      jsonlFiles.push({ filePath, mtimeMs: stats.mtimeMs });
    } catch {
      // Skip unreadable entries
    }
  }

  if (jsonlFiles.length === 0) return null;

  jsonlFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return jsonlFiles[0].filePath;
}
