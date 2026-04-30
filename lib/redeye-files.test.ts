// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  scanMaxTaskId,
  readProjectDetail,
  readArchivedTasks,
  readAllTasks,
  readArchivedInbox,
  readArchivedChangelog,
} from "./redeye-files";
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

  it("recentlyShipped is still sliced to 10 items max", async () => {
    tmpDir = await createProjectWithDoneItems(12);
    const project = { ...fakeProject, path: tmpDir };
    const detail = await readProjectDetail(tmpDir, project);
    expect(detail.recentlyShipped.length).toBeLessThanOrEqual(10);
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

// ----------------------------------------------------------------------------
// readArchivedTasks / readAllTasks — done tasks live entirely outside tasks.md
// ----------------------------------------------------------------------------

describe("readArchivedTasks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-archive-"));
  });

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns [] when docs/tasks-archive does not exist", async () => {
    const items = await readArchivedTasks(tmpDir);
    expect(items).toEqual([]);
  });

  it("returns [] when docs/tasks-archive is empty", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    const items = await readArchivedTasks(tmpDir);
    expect(items).toEqual([]);
  });

  it("parses task blocks from a single archive file", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-04.md"),
      `# Tasks archive — 2026-04

### T001: Build X
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-28 (iter 100)
- **Description:** First.

### T002: Fix Y
- **Type:** bug
- **Status:** done
- **Merged:** 2026-04-29 (iter 101)
- **Description:** Second.
`,
      "utf-8"
    );
    const items = await readArchivedTasks(tmpDir);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === "T001")?.description).toContain("First");
    expect(items.find((i) => i.id === "T002")?.description).toContain("Second");
  });

  it("merges entries across multiple monthly archive files", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-03.md"),
      `### T001: Old\n- **Status:** done\n- **Description:** From March.\n`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-04.md"),
      `### T002: Newer\n- **Status:** done\n- **Description:** From April.\n`,
      "utf-8"
    );
    const items = await readArchivedTasks(tmpDir);
    expect(items.map((i) => i.id).sort()).toEqual(["T001", "T002"]);
  });

  it("ignores non-.md files in the archive directory", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "docs/tasks-archive/notes.txt"), "irrelevant", "utf-8");
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-04.md"),
      `### T001: Real\n- **Status:** done\n- **Description:** Body.\n`,
      "utf-8"
    );
    const items = await readArchivedTasks(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("T001");
  });
});

describe("readAllTasks", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-all-tasks-"));
    await fs.mkdir(path.join(tmpDir, ".redeye"), { recursive: true });
  });

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns active + archived combined", async () => {
    await fs.writeFile(
      path.join(tmpDir, ".redeye/tasks.md"),
      `## CEO Requests\n\n### T002: Active\n- **Status:** pending\n`,
      "utf-8"
    );
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-04.md"),
      `### T001: Archived\n- **Status:** done\n`,
      "utf-8"
    );
    const items = await readAllTasks(tmpDir);
    expect(items.map((i) => i.id).sort()).toEqual(["T001", "T002"]);
  });

  it("active tasks.md wins on id collisions (a re-opened task)", async () => {
    await fs.writeFile(
      path.join(tmpDir, ".redeye/tasks.md"),
      `## CEO Requests\n\n### T001: Re-opened\n- **Status:** in-progress\n`,
      "utf-8"
    );
    await fs.mkdir(path.join(tmpDir, "docs/tasks-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/tasks-archive/2026-04.md"),
      `### T001: Old archived copy\n- **Status:** done\n`,
      "utf-8"
    );
    const items = await readAllTasks(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("in-progress");
  });
});

// ----------------------------------------------------------------------------
// readArchivedInbox / readArchivedChangelog — incorporated Q-XXX entries and
// prior-month iteration entries live entirely outside .redeye/.
// ----------------------------------------------------------------------------

describe("readArchivedInbox", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-inbox-archive-"));
  });

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns [] when archive directory does not exist", async () => {
    const items = await readArchivedInbox(tmpDir);
    expect(items).toEqual([]);
  });

  it("parses Q-XXX blocks from a single archive file", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/inbox-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/inbox-archive/2026-04.md"),
      `# Inbox archive — 2026-04

### Q-001: First incorporated question
- **From:** CTO
- **Question:** Pick an option
- **Answer:** option 2
- **Incorporated:** 2026-04-15

### Q-002: Second incorporated
- **From:** CTO
- **Answer:** option 1
- **Incorporated:** 2026-04-20
`,
      "utf-8"
    );
    const items = await readArchivedInbox(tmpDir);
    expect(items).toHaveLength(2);
    expect(items.find((q) => q.id === "Q-001")?.answered).toBe(true);
    expect(items.find((q) => q.id === "Q-002")?.answer).toBe("option 1");
  });

  it("merges entries across multiple monthly archive files", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/inbox-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/inbox-archive/2026-03.md"),
      `### Q-001: March entry\n- **Answer:** ok\n- **Incorporated:** 2026-03-12\n`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "docs/inbox-archive/2026-04.md"),
      `### Q-002: April entry\n- **Answer:** ok\n- **Incorporated:** 2026-04-12\n`,
      "utf-8"
    );
    const items = await readArchivedInbox(tmpDir);
    expect(items.map((q) => q.id).sort()).toEqual(["Q-001", "Q-002"]);
  });

  it("ignores non-.md files in the archive directory", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/inbox-archive"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/inbox-archive/notes.txt"),
      "not markdown",
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "docs/inbox-archive/2026-04.md"),
      `### Q-001: Real\n- **Answer:** ok\n- **Incorporated:** 2026-04-15\n`,
      "utf-8"
    );
    const items = await readArchivedInbox(tmpDir);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("Q-001");
  });
});

describe("readArchivedChangelog", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-cl-archive-"));
  });

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns [] when archive directory does not exist", async () => {
    const items = await readArchivedChangelog(tmpDir);
    expect(items).toEqual([]);
  });

  it("parses iteration blocks from a single archive file", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/changelog-archive"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tmpDir, "docs/changelog-archive/2026-03.md"),
      `# Changelog archive — 2026-03

## Iteration 10 — 2026-03-15T10:00:00Z
- **Built:** T010 Old work

## Iteration 11 — 2026-03-20T10:00:00Z
- **Built:** T011 More old work
`,
      "utf-8"
    );
    const items = await readArchivedChangelog(tmpDir);
    expect(items).toHaveLength(2);
  });

  it("merges entries across multiple monthly files", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/changelog-archive"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tmpDir, "docs/changelog-archive/2026-03.md"),
      `## Iteration 5 — 2026-03-15T10:00:00Z\n- **Built:** T005 ok\n`,
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "docs/changelog-archive/2026-04.md"),
      `## Iteration 6 — 2026-04-15T10:00:00Z\n- **Built:** T006 ok\n`,
      "utf-8"
    );
    const items = await readArchivedChangelog(tmpDir);
    expect(items).toHaveLength(2);
  });

  it("ignores non-.md files", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/changelog-archive"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tmpDir, "docs/changelog-archive/notes.txt"),
      "irrelevant",
      "utf-8"
    );
    await fs.writeFile(
      path.join(tmpDir, "docs/changelog-archive/2026-04.md"),
      `## Iteration 1 — 2026-04-01T10:00:00Z\n- **Built:** T001 ok\n`,
      "utf-8"
    );
    const items = await readArchivedChangelog(tmpDir);
    expect(items).toHaveLength(1);
  });
});
