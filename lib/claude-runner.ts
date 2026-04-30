import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { ClaudeStreamEvent } from "./redeye-types";

export const REDEYE_PLUGIN_DIR =
  process.env.REDEYE_PLUGIN_DIR || path.join(os.homedir(), "redeye");

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";

/** Parse one JSONL line into a ClaudeStreamEvent. Throws on invalid input. */
export function parseStreamEvent(line: string): ClaudeStreamEvent {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new SyntaxError("Empty line cannot be parsed as a stream event");
  }

  const parsed = JSON.parse(trimmed);

  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    throw new Error("Stream event is missing required `type` field");
  }

  return parsed as ClaudeStreamEvent;
}

export function runClaudeCommand(
  projectPath: string,
  command: string,
  model?: string
): Promise<ClaudeStreamEvent[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "--print",
      "--verbose",
      "--output-format",
      "stream-json",
      "--dangerously-skip-permissions",
      "--model",
      model || "sonnet",
      "--plugin-dir",
      REDEYE_PLUGIN_DIR,
      "-p",
      command,
    ];

    const proc = spawn(CLAUDE_BIN, args, {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const events: ClaudeStreamEvent[] = [];
    let buffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          events.push(parseStreamEvent(line));
        } catch {
          // ignore unparseable lines
        }
      }
    });

    proc.on("close", (code) => {
      if (buffer.trim()) {
        try {
          events.push(parseStreamEvent(buffer));
        } catch {
          // ignore malformed trailing data
        }
      }

      if (code !== 0 && events.length === 0) {
        reject(
          new Error(`claude exited with code ${code} and produced no events`)
        );
      } else {
        resolve(events);
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export interface SpawnedSession {
  pid: number;
  logFile: string;
}

/**
 * Rotate the session log if it exceeds SESSION_LOG_MAX_BYTES.
 * The active log lives inside the project's .redeye/ which is watched by
 * the dev-server file system indexer; an unbounded log balloons heap usage.
 * Archives go in .redeye/archive/ which downstream readers can ignore.
 */
export const SESSION_LOG_MAX_BYTES = 5 * 1024 * 1024;

function rotateSessionLogIfLarge(logFile: string): void {
  let size: number;
  try {
    size = fs.statSync(logFile).size;
  } catch {
    return; // file does not exist yet — nothing to rotate
  }
  if (size <= SESSION_LOG_MAX_BYTES) return;

  const archiveDir = path.join(path.dirname(logFile), "archive");
  try {
    fs.mkdirSync(archiveDir, { recursive: true });
  } catch {
    return; // can't make archive dir — leave the log as-is rather than lose it
  }

  const base = path.basename(logFile, ".jsonl");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archivedPath = path.join(archiveDir, `${base}-${ts}.jsonl`);
  try {
    fs.renameSync(logFile, archivedPath);
  } catch {
    // ignore — caller will append to the existing file
  }
}

export function spawnClaudeSession(
  projectPath: string,
  role: string,
  prompt: string,
  model?: string
): SpawnedSession {
  const redeyeDir = path.join(projectPath, ".redeye");
  fs.mkdirSync(redeyeDir, { recursive: true });

  const logFile = path.join(redeyeDir, `session-${role}.jsonl`);
  rotateSessionLogIfLarge(logFile);
  const logFd = fs.openSync(logFile, "a");

  const args = [
    "--print",
    "--verbose",
    "--output-format",
    "stream-json",
    "--dangerously-skip-permissions",
    "--model",
    model || "sonnet",
    "--plugin-dir",
    REDEYE_PLUGIN_DIR,
    "-p",
    prompt,
  ];

  // Merge stderr into the same fd as stdout. Previously we used "pipe" which
  // had no consumer, so after ~64 KB of stderr the pipe buffer filled and
  // claude blocked, looking like a stall. Writing stderr to the log fd
  // captures it and avoids the deadlock.
  // stdin = "ignore" so the child gets /dev/null. Previously this was
  // "pipe" with no consumer; after the autonomous loop emitted its final
  // result and STOP promise, claude --print kept the process alive for
  // hours waiting on stdin (observed: 11+ h orphan PID after queue
  // exhaustion). With stdin closed at spawn time, the binary can exit
  // cleanly when the prompt completes.
  const proc = spawn(CLAUDE_BIN, args, {
    cwd: projectPath,
    stdio: ["ignore", logFd, logFd],
    detached: true,
  });

  fs.closeSync(logFd);
  proc.unref();

  if (proc.pid == null) {
    throw new Error(`Failed to spawn claude session for role "${role}"`);
  }

  return { pid: proc.pid, logFile };
}
