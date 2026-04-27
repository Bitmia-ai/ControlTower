// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { scanMaxTaskId, readProjectDetail } from "./redeye-files";
import type { ProjectWithStatus } from "./redeye-types";

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

describe("scanMaxTaskId", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns 0 when tasks.md does not exist", async () => {
    tmpDir = await createTempProject(); // no tasks.md
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns 0 when tasks.md is empty", async () => {
    tmpDir = await createTempProject("");
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns 0 when tasks.md has no T<N> items", async () => {
    tmpDir = await createTempProject("# Backlog\n\nSome content without any IDs.\n");
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(0);
  });

  it("returns the single BL number when one item exists", async () => {
    tmpDir = await createTempProject(
      "# Backlog\n\n## T005: Some task\n- Status: pending\n"
    );
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(5);
  });

  it("returns the highest number when multiple items exist", async () => {
    tmpDir = await createTempProject(
      "# Backlog\n\n## T003: Task three\n## T001: Task one\n## T007: Task seven\n"
    );
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(7);
  });

  it("returns the highest number when items have gaps", async () => {
    tmpDir = await createTempProject(
      "## T001: First\n## T010: Tenth\n## T004: Fourth\n"
    );
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(10);
  });

  it("handles double-digit and triple-digit BL numbers correctly", async () => {
    tmpDir = await createTempProject(
      "## T011: Eleven\n## T099: Ninety-nine\n## T100: Hundred\n"
    );
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(100);
  });

  it("handles BL IDs appearing inline in text (not just headers)", async () => {
    tmpDir = await createTempProject(
      "Some text mentioning T002 and T015 within sentences.\n"
    );
    const result = await scanMaxTaskId(tmpDir);
    expect(result).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// T086: readProjectDetail — allDoneItems must include all done tasks, not slice
// ---------------------------------------------------------------------------

/**
 * Create a minimal project directory with tasks.md containing N done items
 * and the required .redeye auxiliary files (state.json, inbox.md, etc.) as empty.
 */
async function createProjectWithDoneItems(count: number): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-files-test-"));
  const redeyeDir = path.join(tmpDir, ".redeye");
  await fs.mkdir(redeyeDir);

  // Build tasks.md with `count` done items (T001 … T<count>)
  const lines: string[] = ["# Backlog\n\n## CEO Requests\n"];
  for (let i = 1; i <= count; i++) {
    const id = `T${String(i).padStart(3, "0")}`;
    lines.push(`### ${id}: Task ${i}`);
    lines.push(`- **Type:** feature`);
    lines.push(`- **Priority:** P1`);
    lines.push(`- **Status:** done`);
    lines.push(`- **Merged:** iteration ${i}`);
    lines.push(``);
  }
  await fs.writeFile(path.join(redeyeDir, "tasks.md"), lines.join("\n"), "utf-8");

  // Empty auxiliary files required by readProjectDetail
  await fs.writeFile(path.join(redeyeDir, "state.json"), "{}", "utf-8");
  await fs.writeFile(path.join(redeyeDir, "inbox.md"), "", "utf-8");
  await fs.writeFile(path.join(redeyeDir, "changelog.md"), "", "utf-8");
  await fs.writeFile(path.join(redeyeDir, "steering.md"), "", "utf-8");

  return tmpDir;
}

describe("readProjectDetail — allDoneItems (T086)", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  const fakeProject: ProjectWithStatus = {
    name: "test",
    path: "",          // overridden per test
    initialized: true,
    running: false,
  };

  it("allDoneItems contains all done items when count > 8 (regression: was sliced to 8)", async () => {
    tmpDir = await createProjectWithDoneItems(12);
    const project = { ...fakeProject, path: tmpDir };
    const detail = await readProjectDetail(tmpDir, project);
    expect(detail.allDoneItems).toHaveLength(12);
  });

  it("recentlyShipped is still sliced to 8 items max", async () => {
    tmpDir = await createProjectWithDoneItems(12);
    const project = { ...fakeProject, path: tmpDir };
    const detail = await readProjectDetail(tmpDir, project);
    expect(detail.recentlyShipped.length).toBeLessThanOrEqual(8);
  });

  it("allDoneItems is sorted newest first (highest iteration descending)", async () => {
    tmpDir = await createProjectWithDoneItems(5);
    const project = { ...fakeProject, path: tmpDir };
    const detail = await readProjectDetail(tmpDir, project);
    const ids = detail.allDoneItems.map((i) => i.id);
    // Tasks are T001..T005 merged at iterations 1..5 — newest first = T005..T001
    expect(ids[0]).toBe("T005");
    expect(ids[ids.length - 1]).toBe("T001");
  });

  it("allDoneItems equals recentlyShipped when count <= 8", async () => {
    tmpDir = await createProjectWithDoneItems(5);
    const project = { ...fakeProject, path: tmpDir };
    const detail = await readProjectDetail(tmpDir, project);
    expect(detail.allDoneItems).toHaveLength(5);
    expect(detail.recentlyShipped).toHaveLength(5);
    expect(detail.allDoneItems.map((i) => i.id)).toEqual(
      detail.recentlyShipped.map((i) => i.id)
    );
  });
});
