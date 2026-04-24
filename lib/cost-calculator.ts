import fs from "fs";
import readline from "readline";
import { resolveTranscriptFile } from "./transcript-file-resolver";

/** Token usage from a Claude CLI assistant event. */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Sonnet pricing per million tokens (USD).
 * Hardcoded per BL-015 AD-1.
 */
const PRICE_PER_M = {
  input: 3.0,
  cache_creation: 3.75,
  cache_read: 0.3,
  output: 15.0,
} as const;

/**
 * Calculate the cost in USD for a single token usage record.
 * Missing fields are treated as 0.
 */
export function calculateCostUsd(usage: TokenUsage): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  return (
    (input * PRICE_PER_M.input +
      output * PRICE_PER_M.output +
      cacheCreation * PRICE_PER_M.cache_creation +
      cacheRead * PRICE_PER_M.cache_read) /
    1_000_000
  );
}

/** Raw JSONL envelope shape (assistant type only). */
interface AssistantEnvelope {
  type: string;
  message?: {
    usage?: TokenUsage;
  };
}

/**
 * Read a JSONL transcript file and sum the cost of all assistant events.
 * Returns 0 if the file does not exist or contains no assistant events with usage.
 * Skips malformed lines without throwing.
 */
export async function sumTranscriptFileCost(filePath: string): Promise<number> {
  // Check existence before opening to avoid unhandled stream errors
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch {
    return 0;
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });

  return new Promise((resolve) => {
    let total = 0;
    let settled = false;

    const settle = (value: number) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    stream.on("error", () => settle(0));

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line) as AssistantEnvelope;
        if (parsed?.type === "assistant" && parsed.message?.usage) {
          total += calculateCostUsd(parsed.message.usage);
        }
      } catch {
        // skip malformed lines
      }
    });

    rl.on("close", () => settle(total));
  });
}

/**
 * Compute the cost of the current session transcript for a project.
 * Resolves the best available transcript file via `resolveTranscriptFile`
 * and sums its cost via `sumTranscriptFileCost`.
 * Returns 0 if no transcript file is found.
 */
export async function sumCurrentSessionCost(projectPath: string): Promise<number> {
  const file = resolveTranscriptFile(projectPath);
  if (!file) return 0;
  return sumTranscriptFileCost(file);
}
