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
 * Hardcoded per T015 AD-1.
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
 * mtime-keyed memo for sumTranscriptFileCost. Old transcripts never change,
 * so we cache by `${filePath}:${mtimeMs}:${size}` and skip the streaming
 * scan on cache hit. The active transcript file's mtime advances on every
 * write, so its result is still recomputed when needed.
 *
 * The cache is bounded at MAX_COST_CACHE_ENTRIES; oldest entries are
 * evicted when the limit is reached.
 */
const MAX_COST_CACHE_ENTRIES = 256;
const costCache = new Map<string, number>();

function evictOldestIfFull(): void {
  while (costCache.size >= MAX_COST_CACHE_ENTRIES) {
    const oldest = costCache.keys().next().value;
    if (oldest === undefined) return;
    costCache.delete(oldest);
  }
}

/** Test-only: clear the in-memory cost cache. Not intended for production use. */
export function __resetCostCacheForTests(): void {
  costCache.clear();
}

async function streamSumTranscriptCost(filePath: string): Promise<number> {
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
 * Read a JSONL transcript file and sum the cost of all assistant events.
 * Cached by `${filePath}:${mtimeMs}:${size}` — repeated calls on
 * unchanged files return instantly without re-streaming.
 *
 * Returns 0 if the file does not exist or contains no assistant events with usage.
 * Skips malformed lines without throwing.
 */
export async function sumTranscriptFileCost(filePath: string): Promise<number> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return 0;
  }
  if (!stat.isFile()) return 0;

  const cacheKey = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  const cached = costCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const total = await streamSumTranscriptCost(filePath);

  evictOldestIfFull();
  costCache.set(cacheKey, total);
  return total;
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
