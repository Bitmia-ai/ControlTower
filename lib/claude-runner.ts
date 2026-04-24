import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { ClaudeStreamEvent } from "./redeye-types";

export const REDEYE_PLUGIN_DIR =
  process.env.REDEYE_PLUGIN_DIR ||
  path.join(process.env.HOME ?? "/root", "redeye");

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

export function spawnClaudeSession(
  projectPath: string,
  role: string,
  prompt: string,
  model?: string
): SpawnedSession {
  const redeyeDir = path.join(projectPath, ".redeye");
  fs.mkdirSync(redeyeDir, { recursive: true });

  const logFile = path.join(redeyeDir, `session-${role}.jsonl`);
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

  const proc = spawn(CLAUDE_BIN, args, {
    cwd: projectPath,
    stdio: ["pipe", logFd, "pipe"],
    detached: true,
  });

  fs.closeSync(logFd);
  proc.unref();

  if (proc.pid == null) {
    throw new Error(`Failed to spawn claude session for role "${role}"`);
  }

  return { pid: proc.pid, logFile };
}
