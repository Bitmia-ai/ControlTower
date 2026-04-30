import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock transcript-file-resolver before importing cost-calculator
vi.mock("./transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
}));

// We also need to control sumTranscriptFileCost behaviour — but since it's in
// the same module we can't easily mock it independently without a separate
// approach. Instead we test sumCurrentSessionCost via the actual
// sumTranscriptFileCost but with a real (temp) file path.
// For the "no file" path we only need resolveTranscriptFile to return null.

import { resolveTranscriptFile } from "./transcript-file-resolver";
import { sumCurrentSessionCost } from "./cost-calculator";
import fs from "fs";
import path from "path";
import os from "os";

const mockResolve = resolveTranscriptFile as ReturnType<typeof vi.fn>;

describe("sumCurrentSessionCost", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-cost-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 when no transcript file is resolved", async () => {
    mockResolve.mockReturnValue(null);
    const cost = await sumCurrentSessionCost("/some/project");
    expect(cost).toBe(0);
    expect(mockResolve).toHaveBeenCalledWith("/some/project");
  });

  it("returns cost from the resolved transcript file", async () => {
    const filePath = path.join(tmpDir, "session.jsonl");
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        type: "assistant",
        message: {
          usage: { output_tokens: 1_000_000 },
          content: [{ type: "text", text: "hi" }],
        },
      })
    );

    mockResolve.mockReturnValue(filePath);
    const cost = await sumCurrentSessionCost("/some/project");
    expect(cost).toBeCloseTo(15.0, 6);
    expect(mockResolve).toHaveBeenCalledWith("/some/project");
  });

  it("returns 0 when resolved file exists but has no assistant events", async () => {
    const filePath = path.join(tmpDir, "empty.jsonl");
    fs.writeFileSync(filePath, "");

    mockResolve.mockReturnValue(filePath);
    const cost = await sumCurrentSessionCost("/some/project");
    expect(cost).toBe(0);
  });
});
