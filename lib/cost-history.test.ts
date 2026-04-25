import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";

const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockSumCost = vi.fn();

vi.mock("fs", () => {
  return {
    default: {
      statSync: (...args: unknown[]) => mockStatSync(...args),
      readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    },
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  };
});

vi.mock("./cost-calculator", () => ({
  sumTranscriptFileCost: (...args: unknown[]) => mockSumCost(...args),
}));

import { getSessionCostHistory } from "./cost-history";

const PROJECT_PATH = "/Users/casa/my-project";
const ENCODED = "-Users-casa-my-project";
const CLI_DIR = path.join(os.homedir(), ".claude", "projects", ENCODED);

beforeEach(() => {
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
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
