import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { calculateCostUsd, sumTranscriptFileCost } from "./cost-calculator";

// sumCurrentSessionCost tests: resolveTranscriptFile is mocked at module level,
// but sumTranscriptFileCost runs for real (reading actual tmp files).
vi.mock("./transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
}));

describe("calculateCostUsd", () => {
  it("returns 3.00 for 1M input tokens", () => {
    expect(calculateCostUsd({ input_tokens: 1_000_000 })).toBeCloseTo(3.0, 6);
  });

  it("returns 15.00 for 1M output tokens", () => {
    expect(calculateCostUsd({ output_tokens: 1_000_000 })).toBeCloseTo(15.0, 6);
  });

  it("returns 3.75 for 1M cache_creation tokens", () => {
    expect(calculateCostUsd({ cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(3.75, 6);
  });

  it("returns 0.30 for 1M cache_read tokens", () => {
    expect(calculateCostUsd({ cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.3, 6);
  });

  it("returns 0 for empty usage object", () => {
    expect(calculateCostUsd({})).toBe(0);
  });

  it("handles undefined fields gracefully", () => {
    expect(calculateCostUsd({ input_tokens: undefined })).toBe(0);
  });

  it("sums all token types correctly", () => {
    const cost = calculateCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.0 + 15.0 + 3.75 + 0.3, 6);
  });

  it("handles small token counts with correct precision", () => {
    // 1000 output tokens = 15 / 1000 = 0.015
    expect(calculateCostUsd({ output_tokens: 1000 })).toBeCloseTo(0.015, 6);
  });

  it("handles zero tokens", () => {
    expect(calculateCostUsd({ input_tokens: 0, output_tokens: 0 })).toBe(0);
  });
});

describe("sumTranscriptFileCost", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cost-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 for file with no assistant events", async () => {
    const filePath = path.join(tmpDir, "test.jsonl");
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({ type: "user", message: { content: "Hello" } }),
        JSON.stringify({ type: "system", content: "system message" }),
      ].join("\n")
    );
    expect(await sumTranscriptFileCost(filePath)).toBe(0);
  });

  it("returns 0 for empty file", async () => {
    const filePath = path.join(tmpDir, "empty.jsonl");
    fs.writeFileSync(filePath, "");
    expect(await sumTranscriptFileCost(filePath)).toBe(0);
  });

  it("returns 0 for file with assistant events but no usage", async () => {
    const filePath = path.join(tmpDir, "no-usage.jsonl");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "hi" }] },
      })
    );
    expect(await sumTranscriptFileCost(filePath)).toBe(0);
  });

  it("sums costs across multiple assistant events", async () => {
    const filePath = path.join(tmpDir, "multi.jsonl");
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: {
          usage: { input_tokens: 1_000_000, output_tokens: 0 },
          content: [{ type: "text", text: "a" }],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          usage: { input_tokens: 0, output_tokens: 1_000_000 },
          content: [{ type: "text", text: "b" }],
        },
      }),
    ];
    fs.writeFileSync(filePath, lines.join("\n"));
    const cost = await sumTranscriptFileCost(filePath);
    expect(cost).toBeCloseTo(3.0 + 15.0, 6);
  });

  it("handles cache tokens in JSONL correctly", async () => {
    const filePath = path.join(tmpDir, "cache.jsonl");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        type: "assistant",
        message: {
          usage: {
            cache_creation_input_tokens: 1_000_000,
            cache_read_input_tokens: 1_000_000,
          },
          content: [{ type: "text", text: "hi" }],
        },
      })
    );
    const cost = await sumTranscriptFileCost(filePath);
    expect(cost).toBeCloseTo(3.75 + 0.3, 6);
  });

  it("skips malformed JSON lines without throwing", async () => {
    const filePath = path.join(tmpDir, "malformed.jsonl");
    fs.writeFileSync(
      filePath,
      [
        "{bad json",
        JSON.stringify({
          type: "assistant",
          message: {
            usage: { output_tokens: 1_000_000 },
            content: [{ type: "text", text: "hi" }],
          },
        }),
      ].join("\n")
    );
    const cost = await sumTranscriptFileCost(filePath);
    expect(cost).toBeCloseTo(15.0, 6);
  });

  it("returns 0 if file does not exist", async () => {
    expect(await sumTranscriptFileCost("/nonexistent/path.jsonl")).toBe(0);
  });
});

describe("sumCurrentSessionCost", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cost-session-test-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 when resolveTranscriptFile returns null", async () => {
    const { resolveTranscriptFile } = await import("./transcript-file-resolver");
    vi.mocked(resolveTranscriptFile).mockReturnValue(null);
    const { sumCurrentSessionCost } = await import("./cost-calculator");
    const result = await sumCurrentSessionCost("/some/project");
    expect(result).toBe(0);
  });

  it("returns cost from transcript when resolveTranscriptFile returns a path", async () => {
    const filePath = path.join(tmpDir, "session.jsonl");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        type: "assistant",
        message: { usage: { output_tokens: 1_000_000 } },
      })
    );
    const { resolveTranscriptFile } = await import("./transcript-file-resolver");
    vi.mocked(resolveTranscriptFile).mockReturnValue(filePath);
    const { sumCurrentSessionCost } = await import("./cost-calculator");
    const result = await sumCurrentSessionCost("/some/project");
    expect(result).toBeCloseTo(15.0, 6);
  });

  it("returns 0 when transcript file is empty", async () => {
    const filePath = path.join(tmpDir, "empty.jsonl");
    fs.writeFileSync(filePath, "");
    const { resolveTranscriptFile } = await import("./transcript-file-resolver");
    vi.mocked(resolveTranscriptFile).mockReturnValue(filePath);
    const { sumCurrentSessionCost } = await import("./cost-calculator");
    const result = await sumCurrentSessionCost("/some/project");
    expect(result).toBe(0);
  });
});
