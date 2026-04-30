// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";
import { Readable } from "stream";
import type { IterationLogEntry } from "./redeye-types";

const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockCreateReadStream = vi.fn();
const mockSumCost = vi.fn();
const mockReadFile = vi.fn();

vi.mock("fs", () => {
  return {
    default: {
      statSync: (...args: unknown[]) => mockStatSync(...args),
      readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
      createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
    },
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
  };
});

vi.mock("fs/promises", () => {
  const enoent = () => Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  return {
    default: {
      readFile: (...args: unknown[]) => mockReadFile(...args),
      access: () => Promise.reject(enoent()),
    },
    readFile: (...args: unknown[]) => mockReadFile(...args),
    access: () => Promise.reject(enoent()),
  };
});

vi.mock("./cost-calculator", async () => {
  const actual = await vi.importActual<typeof import("./cost-calculator")>("./cost-calculator");
  return {
    ...actual,
    sumTranscriptFileCost: (...args: unknown[]) => mockSumCost(...args),
  };
});

import {
  getSessionCostHistory,
  getSessionHistory,
  matchIterationLogToSession,
  __resetScanCacheForTests,
} from "./cost-history";

/**
 * Helper to create a mock readable stream from an array of lines.
 * The stream is consumed by readline.createInterface.
 */
function mockJsonlStream(lines: string[]) {
  return Readable.from(lines.map((l) => l + "\n"));
}

const PROJECT_PATH = path.join(os.homedir(), "my-project");
const ENCODED = PROJECT_PATH.replace(/\//g, "-");
const CLI_DIR = path.join(os.homedir(), ".claude", "projects", ENCODED);

beforeEach(() => {
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
  mockCreateReadStream.mockReset();
  mockSumCost.mockReset();
  mockReadFile.mockReset();
  // Default: state.json absent (ENOENT) — keeps existing tests green
  mockReadFile.mockImplementation(() => {
    return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
  });
  __resetScanCacheForTests();
});

describe("getSessionCostHistory", () => {
  it("returns empty array when cliDir is unreadable", async () => {
    mockReaddirSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toEqual([]);
  });

  it("returns empty array when there are no .jsonl files", async () => {
    mockReaddirSync.mockReturnValue(["foo.txt", "bar.md"]);
    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toEqual([]);
  });

  it("returns sessions in ascending mtime order with costs", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl", "b.jsonl", "c.jsonl"]);
    mockStatSync.mockImplementation((p: string) => {
      if (p === path.join(CLI_DIR, "a.jsonl")) return { mtimeMs: 3000, isDirectory: () => false };
      if (p === path.join(CLI_DIR, "b.jsonl")) return { mtimeMs: 1000, isDirectory: () => false };
      if (p === path.join(CLI_DIR, "c.jsonl")) return { mtimeMs: 2000, isDirectory: () => false };
      throw new Error("not found");
    });
    mockSumCost.mockImplementation(async (file: string) => {
      if (file.endsWith("a.jsonl")) return 1.5;
      if (file.endsWith("b.jsonl")) return 0.5;
      if (file.endsWith("c.jsonl")) return 1.0;
      return 0;
    });

    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toEqual([
      { file: "b.jsonl", cost: 0.5, mtimeMs: 1000 },
      { file: "c.jsonl", cost: 1.0, mtimeMs: 2000 },
      { file: "a.jsonl", cost: 1.5, mtimeMs: 3000 },
    ]);
  });

  it("caps results at limit (default 10) by keeping most-recent N", async () => {
    const files = Array.from({ length: 15 }, (_, i) => `s${i}.jsonl`);
    mockReaddirSync.mockReturnValue(files);
    mockStatSync.mockImplementation((p: string) => {
      const base = path.basename(p);
      const idx = parseInt(base.replace(/^s|\.jsonl$/g, ""), 10);
      return { mtimeMs: idx * 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.1);

    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toHaveLength(10);
    // last 10 most-recent by mtime → indexes 5..14, ascending
    expect(result.map((r) => r.file)).toEqual([
      "s5.jsonl",
      "s6.jsonl",
      "s7.jsonl",
      "s8.jsonl",
      "s9.jsonl",
      "s10.jsonl",
      "s11.jsonl",
      "s12.jsonl",
      "s13.jsonl",
      "s14.jsonl",
    ]);
  });

  it("respects custom limit param", async () => {
    const files = Array.from({ length: 5 }, (_, i) => `s${i}.jsonl`);
    mockReaddirSync.mockReturnValue(files);
    mockStatSync.mockImplementation((p: string) => {
      const base = path.basename(p);
      const idx = parseInt(base.replace(/^s|\.jsonl$/g, ""), 10);
      return { mtimeMs: idx * 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.2);

    const result = await getSessionCostHistory(PROJECT_PATH, 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.file)).toEqual(["s2.jsonl", "s3.jsonl", "s4.jsonl"]);
  });

  it("skips directories", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl", "subdir.jsonl"]);
    mockStatSync.mockImplementation((p: string) => {
      if (p.endsWith("subdir.jsonl")) return { mtimeMs: 5000, isDirectory: () => true };
      return { mtimeMs: 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.3);

    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("a.jsonl");
  });

  it("skips entries that fail statSync", async () => {
    mockReaddirSync.mockReturnValue(["good.jsonl", "broken.jsonl"]);
    mockStatSync.mockImplementation((p: string) => {
      if (p.endsWith("broken.jsonl")) throw new Error("EACCES");
      return { mtimeMs: 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.4);

    const result = await getSessionCostHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("good.jsonl");
  });
});

describe("getSessionHistory", () => {
  it("returns [] when cliDir is unreadable", async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toEqual([]);
  });

  it("returns sessions with phases sorted ascending by mtime", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl", "b.jsonl"]);
    mockStatSync.mockImplementation((p: string) => {
      if (p.endsWith("a.jsonl")) return { mtimeMs: 2000, size: 100, isDirectory: () => false };
      if (p.endsWith("b.jsonl")) return { mtimeMs: 1000, size: 100, isDirectory: () => false };
      throw new Error("not found");
    });
    // 500_000 input tokens × $3/M = $1.5 ; 166_666 input tokens × $3/M ≈ $0.5
    mockCreateReadStream.mockImplementation((p: string) => {
      if (p.endsWith("a.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({ type: "user", message: { content: "Entering BUILD phase" } }),
          JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 500_000 } } }),
        ]);
      }
      if (p.endsWith("b.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({ type: "user", message: { content: "Entering PLAN phase" } }),
          JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 166_666 } } }),
        ]);
      }
      return mockJsonlStream([]);
    });

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("b.jsonl");
    expect(result[0].cost).toBeCloseTo(0.5, 3);
    expect(result[0].mtimeMs).toBe(1000);
    expect(result[0].phases).toEqual(["PLAN"]);
    expect(result[1].file).toBe("a.jsonl");
    expect(result[1].cost).toBeCloseTo(1.5, 3);
    expect(result[1].phases).toEqual(["BUILD"]);
  });

  it("respects limit param (default 50)", async () => {
    const files = Array.from({ length: 60 }, (_, i) => `s${i}.jsonl`);
    mockReaddirSync.mockReturnValue(files);
    mockStatSync.mockImplementation((p: string) => {
      const base = path.basename(p);
      const idx = parseInt(base.replace(/^s|\.jsonl$/g, ""), 10);
      return { mtimeMs: idx * 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.1);
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(50);
    // Should keep most-recent 50 (idx 10..59)
    expect(result[0].file).toBe("s10.jsonl");
    expect(result[result.length - 1].file).toBe("s59.jsonl");
  });

  it("respects custom limit", async () => {
    const files = ["a.jsonl", "b.jsonl", "c.jsonl"];
    mockReaddirSync.mockReturnValue(files);
    mockStatSync.mockImplementation((p: string) => {
      const base = path.basename(p);
      const order = { "a.jsonl": 1, "b.jsonl": 2, "c.jsonl": 3 } as Record<string, number>;
      return { mtimeMs: order[base] * 1000, isDirectory: () => false };
    });
    mockSumCost.mockResolvedValue(0.2);
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));

    const result = await getSessionHistory(PROJECT_PATH, 2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.file)).toEqual(["b.jsonl", "c.jsonl"]);
  });

  it("includes startedAt and durationMs from first-line timestamp", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    mockStatSync.mockImplementation(() => ({ mtimeMs: 5_000, isDirectory: () => false }));
    mockSumCost.mockResolvedValue(0.1);
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({ type: "user", timestamp: "1970-01-01T00:00:01.000Z", message: { content: "hi" } }),
      ])
    );

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].startedAt).toBe(1000);
    expect(result[0].durationMs).toBe(4000);
  });

  it("falls back to mtimeMs for startedAt if no timestamp parseable", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    mockStatSync.mockImplementation(() => ({ mtimeMs: 5_000, isDirectory: () => false }));
    mockSumCost.mockResolvedValue(0.1);
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].startedAt).toBe(5000);
    expect(result[0].durationMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T128: matchIterationLogToSession + getSessionHistory enrichment
// ---------------------------------------------------------------------------

describe("matchIterationLogToSession", () => {
  it("returns [] when log is undefined", () => {
    expect(matchIterationLogToSession(undefined, 1000, 2000)).toEqual([]);
  });

  it("returns [] when log is null", () => {
    expect(matchIterationLogToSession(null, 1000, 2000)).toEqual([]);
  });

  it("returns [] when log is empty", () => {
    expect(matchIterationLogToSession([], 1000, 2000)).toEqual([]);
  });

  it("returns entries whose timestamp falls within [startedAt, startedAt+durationMs]", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const duration = 60 * 60 * 1000; // 1 hour
    const inWindow = {
      iteration: 5,
      phases: ["BUILD"],
      outcome: "T1 done",
      timestamp: "2026-04-28T12:30:00Z",
    };
    const result = matchIterationLogToSession([inWindow], start, duration);
    expect(result).toEqual([{ iteration: 5, outcome: "T1 done", phases: ["BUILD"] }]);
  });

  it("excludes entries outside the window (well past tolerance)", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const duration = 60 * 60 * 1000;
    const beforeWindow = {
      iteration: 4,
      phases: ["TRIAGE"],
      outcome: "old",
      timestamp: "2026-04-28T10:00:00Z",
    };
    const afterWindow = {
      iteration: 6,
      phases: ["DEPLOY"],
      outcome: "later",
      timestamp: "2026-04-28T14:00:00Z",
    };
    const result = matchIterationLogToSession([beforeWindow, afterWindow], start, duration);
    expect(result).toEqual([]);
  });

  it("widens the window to ±5 min when durationMs is 0", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const closeBefore = {
      iteration: 1,
      phases: ["TRIAGE"],
      outcome: "just before",
      timestamp: "2026-04-28T11:58:00Z",
    };
    const closeAfter = {
      iteration: 2,
      phases: ["PLAN"],
      outcome: "just after",
      timestamp: "2026-04-28T12:04:00Z",
    };
    const farAfter = {
      iteration: 3,
      phases: ["BUILD"],
      outcome: "far after",
      timestamp: "2026-04-28T12:10:00Z",
    };
    const result = matchIterationLogToSession(
      [closeBefore, closeAfter, farAfter],
      start,
      0
    );
    expect(result.map((r) => r.iteration)).toEqual([1, 2]);
  });

  it("skips malformed timestamp strings without throwing", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const duration = 60 * 60 * 1000;
    const bad = {
      iteration: 9,
      phases: ["BUILD"],
      outcome: "bad ts",
      timestamp: "not-a-date",
    } as unknown as IterationLogEntry;
    const good = {
      iteration: 10,
      phases: ["BUILD"],
      outcome: "ok",
      timestamp: "2026-04-28T12:30:00Z",
    };
    const result = matchIterationLogToSession([bad, good], start, duration);
    expect(result.map((r) => r.iteration)).toEqual([10]);
  });

  it("returns IterationSummary shape { iteration, outcome, phases }", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const duration = 60 * 60 * 1000;
    const result = matchIterationLogToSession(
      [
        {
          iteration: 42,
          phases: ["BUILD", "REVIEW"],
          outcome: "T42 wired up",
          next: "DEPLOY",
          timestamp: "2026-04-28T12:30:00Z",
        },
      ],
      start,
      duration
    );
    expect(result).toEqual([
      { iteration: 42, outcome: "T42 wired up", phases: ["BUILD", "REVIEW"] },
    ]);
    // No `next`/`timestamp` leaked through
    expect(result[0]).not.toHaveProperty("next");
    expect(result[0]).not.toHaveProperty("timestamp");
  });

  it("uses 60s tolerance on each side of the duration window by default", () => {
    const start = Date.parse("2026-04-28T12:00:00Z");
    const duration = 60_000; // 1 min
    const justBefore = {
      iteration: 1,
      phases: ["X"],
      outcome: "−30s",
      timestamp: new Date(start - 30_000).toISOString(),
    };
    const justAfter = {
      iteration: 2,
      phases: ["Y"],
      outcome: "+30s past end",
      timestamp: new Date(start + duration + 30_000).toISOString(),
    };
    const result = matchIterationLogToSession([justBefore, justAfter], start, duration);
    expect(result.map((r) => r.iteration)).toEqual([1, 2]);
  });
});

describe("getSessionHistory enrichment with iteration_log", () => {
  it("populates iterationSummaries when state.json has matching entries", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    const start = Date.parse("2026-04-28T12:00:00Z");
    const end = Date.parse("2026-04-28T13:00:00Z");
    mockStatSync.mockImplementation(() => ({
      mtimeMs: end,
      size: 100,
      isDirectory: () => false,
    }));
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({
          type: "user",
          timestamp: new Date(start).toISOString(),
          message: { content: "Entering BUILD phase" },
        }),
      ])
    );
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        iteration_log: [
          {
            iteration: 99,
            phases: ["BUILD"],
            outcome: "T128 wired",
            timestamp: "2026-04-28T12:30:00Z",
          },
        ],
      })
    );

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].iterationSummaries).toEqual([
      { iteration: 99, outcome: "T128 wired", phases: ["BUILD"] },
    ]);
  });

  it("returns iterationSummaries: [] when state.json is absent (ENOENT)", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    mockStatSync.mockImplementation(() => ({
      mtimeMs: 5_000,
      size: 100,
      isDirectory: () => false,
    }));
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));
    // mockReadFile defaults to ENOENT in beforeEach

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].iterationSummaries).toEqual([]);
  });

  it("returns iterationSummaries: [] when state.json has no matching log entries", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    const start = Date.parse("2026-04-28T12:00:00Z");
    mockStatSync.mockImplementation(() => ({
      mtimeMs: start + 60_000,
      size: 100,
      isDirectory: () => false,
    }));
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({
          type: "user",
          timestamp: new Date(start).toISOString(),
          message: { content: "" },
        }),
      ])
    );
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        iteration_log: [
          {
            iteration: 1,
            phases: ["TRIAGE"],
            outcome: "way before",
            timestamp: "2020-01-01T00:00:00Z",
          },
        ],
      })
    );

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].iterationSummaries).toEqual([]);
  });

  it("handles malformed state.json gracefully (no throw)", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl"]);
    mockStatSync.mockImplementation(() => ({
      mtimeMs: 5_000,
      size: 100,
      isDirectory: () => false,
    }));
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));
    mockReadFile.mockResolvedValue("{ not valid json");

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(1);
    expect(result[0].iterationSummaries).toEqual([]);
  });

  it("distributes iteration_log entries to the correct sessions by timestamp", async () => {
    mockReaddirSync.mockReturnValue(["a.jsonl", "b.jsonl"]);
    const startA = Date.parse("2026-04-28T10:00:00Z");
    const endA = Date.parse("2026-04-28T11:00:00Z");
    const startB = Date.parse("2026-04-28T14:00:00Z");
    const endB = Date.parse("2026-04-28T15:00:00Z");
    mockStatSync.mockImplementation((p: string) => {
      if (p.endsWith("a.jsonl")) {
        return { mtimeMs: endA, size: 100, isDirectory: () => false };
      }
      if (p.endsWith("b.jsonl")) {
        return { mtimeMs: endB, size: 100, isDirectory: () => false };
      }
      throw new Error("not found");
    });
    mockCreateReadStream.mockImplementation((p: string) => {
      if (p.endsWith("a.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({
            type: "user",
            timestamp: new Date(startA).toISOString(),
            message: { content: "" },
          }),
        ]);
      }
      if (p.endsWith("b.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({
            type: "user",
            timestamp: new Date(startB).toISOString(),
            message: { content: "" },
          }),
        ]);
      }
      return mockJsonlStream([]);
    });
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        iteration_log: [
          {
            iteration: 1,
            phases: ["BUILD"],
            outcome: "in A",
            timestamp: "2026-04-28T10:30:00Z",
          },
          {
            iteration: 2,
            phases: ["BUILD"],
            outcome: "in B",
            timestamp: "2026-04-28T14:30:00Z",
          },
        ],
      })
    );

    const result = await getSessionHistory(PROJECT_PATH);
    // Sorted ascending by mtime: a, b
    const aEntry = result.find((r) => r.file === "a.jsonl");
    const bEntry = result.find((r) => r.file === "b.jsonl");
    expect(aEntry?.iterationSummaries?.map((s) => s.outcome)).toEqual(["in A"]);
    expect(bEntry?.iterationSummaries?.map((s) => s.outcome)).toEqual(["in B"]);
  });
});
