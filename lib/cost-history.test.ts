import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";

const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockCreateReadStream = vi.fn();
const mockSumCost = vi.fn();

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

vi.mock("./cost-calculator", () => ({
  sumTranscriptFileCost: (...args: unknown[]) => mockSumCost(...args),
}));

import { getSessionCostHistory, extractSessionPhases, getSessionHistory } from "./cost-history";

/**
 * Helper to create a mock readable stream from an array of lines.
 * The stream is consumed by readline.createInterface.
 */
function mockJsonlStream(lines: string[]) {
  const { Readable } = require("stream");
  return Readable.from(lines.map((l) => l + "\n"));
}

const PROJECT_PATH = "/Users/casa/my-project";
const ENCODED = "-Users-casa-my-project";
const CLI_DIR = path.join(os.homedir(), ".claude", "projects", ENCODED);

beforeEach(() => {
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
  mockCreateReadStream.mockReset();
  mockSumCost.mockReset();
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

describe("extractSessionPhases", () => {
  it("returns [] when file cannot be read", async () => {
    mockCreateReadStream.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const result = await extractSessionPhases("/missing/file.jsonl");
    expect(result).toEqual([]);
  });

  it("returns [] for empty file", async () => {
    mockCreateReadStream.mockImplementation(() => mockJsonlStream([]));
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual([]);
  });

  it("returns [] when no phase markers present", async () => {
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({ type: "user", message: { content: "hello world" } }),
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }),
      ])
    );
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual([]);
  });

  it("extracts a single phase from 'Entering PLAN phase' text", async () => {
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({ type: "user", message: { content: "Entering PLAN phase now" } }),
      ])
    );
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual(["PLAN"]);
  });

  it("extracts ordered distinct phases", async () => {
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({ type: "user", message: { content: "phase: TRIAGE start" } }),
        JSON.stringify({ type: "user", message: { content: "Entering PLAN phase" } }),
        JSON.stringify({ type: "user", message: { content: "phase: BUILD" } }),
        JSON.stringify({ type: "user", message: { content: "Entering REVIEW phase" } }),
        // duplicate should be deduped
        JSON.stringify({ type: "user", message: { content: "phase: BUILD again" } }),
      ])
    );
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual(["TRIAGE", "PLAN", "BUILD", "REVIEW"]);
  });

  it("skips malformed JSON lines without throwing", async () => {
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        "not valid json {{{",
        JSON.stringify({ type: "user", message: { content: "Entering DEPLOY phase" } }),
        "another bad line",
      ])
    );
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual(["DEPLOY"]);
  });

  it("scans nested message content arrays for phase text", async () => {
    mockCreateReadStream.mockImplementation(() =>
      mockJsonlStream([
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "Entering MERGE phase" }] },
        }),
      ])
    );
    const result = await extractSessionPhases("/some/file.jsonl");
    expect(result).toEqual(["MERGE"]);
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
      if (p.endsWith("a.jsonl")) return { mtimeMs: 2000, isDirectory: () => false };
      if (p.endsWith("b.jsonl")) return { mtimeMs: 1000, isDirectory: () => false };
      throw new Error("not found");
    });
    mockSumCost.mockImplementation(async (file: string) => {
      if (file.endsWith("a.jsonl")) return 1.5;
      if (file.endsWith("b.jsonl")) return 0.5;
      return 0;
    });
    mockCreateReadStream.mockImplementation((p: string) => {
      if (p.endsWith("a.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({ type: "user", message: { content: "ts:1900" } }),
          JSON.stringify({ type: "user", message: { content: "Entering BUILD phase" } }),
        ]);
      }
      if (p.endsWith("b.jsonl")) {
        return mockJsonlStream([
          JSON.stringify({ type: "user", message: { content: "Entering PLAN phase" } }),
        ]);
      }
      return mockJsonlStream([]);
    });

    const result = await getSessionHistory(PROJECT_PATH);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("b.jsonl");
    expect(result[0].cost).toBe(0.5);
    expect(result[0].mtimeMs).toBe(1000);
    expect(result[0].phases).toEqual(["PLAN"]);
    expect(result[1].file).toBe("a.jsonl");
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
