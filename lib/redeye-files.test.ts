import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { scanMaxBacklogId } from "./redeye-files";

// Helper to create a temp project directory with .redeye/tasks.md
async function createTempProject(backlogContent?: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-test-"));
  const redeyeDir = path.join(tmpDir, ".redeye");
  await fs.mkdir(redeyeDir);
  if (backlogContent !== undefined) {
    await fs.writeFile(path.join(redeyeDir, "tasks.md"), backlogContent, "utf-8");
  }
  return tmpDir;
}

describe("scanMaxBacklogId", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns 0 when tasks.md does not exist", async () => {
    tmpDir = await createTempProject(); // no tasks.md
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns 0 when tasks.md is empty", async () => {
    tmpDir = await createTempProject("");
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns 0 when tasks.md has no BL-xxx items", async () => {
    tmpDir = await createTempProject("# Backlog\n\nSome content without any IDs.\n");
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns the single BL number when one item exists", async () => {
    tmpDir = await createTempProject(
      "# Backlog\n\n## BL-005: Some task\n- Status: pending\n"
    );
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(5);
  });

  it("returns the highest number when multiple items exist", async () => {
    tmpDir = await createTempProject(
      "# Backlog\n\n## BL-003: Task three\n## BL-001: Task one\n## BL-007: Task seven\n"
    );
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(7);
  });

  it("returns the highest number when items have gaps", async () => {
    tmpDir = await createTempProject(
      "## BL-001: First\n## BL-010: Tenth\n## BL-004: Fourth\n"
    );
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(10);
  });

  it("handles double-digit and triple-digit BL numbers correctly", async () => {
    tmpDir = await createTempProject(
      "## BL-011: Eleven\n## BL-099: Ninety-nine\n## BL-100: Hundred\n"
    );
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(100);
  });

  it("handles BL IDs appearing inline in text (not just headers)", async () => {
    tmpDir = await createTempProject(
      "Some text mentioning BL-002 and BL-015 within sentences.\n"
    );
    const result = await scanMaxBacklogId(tmpDir);
    expect(result).toBe(15);
  });
});
