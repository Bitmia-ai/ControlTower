import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the fs/promises module so no real disk I/O happens
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
  readFile: vi.fn(),
  access: vi.fn(),
}));

import fs from "fs/promises";
import { readProjectDetail } from "../redeye-files";
import type { ProjectWithStatus, TaskItem, RedEyeState } from "../redeye-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockProject: ProjectWithStatus = {
  name: "test-project",
  path: "/tmp/test-project",
  initialized: true,
  running: false,
};

function makeState(task_id: string | null): RedEyeState {
  return {
    iteration: 1,
    phase: "BUILD",
    phase_status: "in-progress",
    task_id,
    task_title: task_id ? "Test task title" : null,
    spec_file: null,
    review_cycles: 0,
    health: {
      confidence: "HIGH",
      env_status: "healthy",
      iterations_since_last_deploy: 0,
      questions_awaiting_ceo: 0,
      blocked_items_count: 0,
    },
    counters: { next_task_id: 2, next_q_id: 1 },
  };
}

// Map from section key to the ## header label used by parseTasks
const SECTION_HEADERS: Record<string, string> = {
  ceo: "## CEO Requests",
  discovered: "## Discovered",
  triaged: "## Triaged",
  wontdo: "## Won't Do",
};

/**
 * Produce a backlog.md string that parseTasks() can parse.
 * Items are grouped by section so each section header appears once.
 */
function makeBacklogMd(items: TaskItem[]): string {
  const bySection: Record<string, TaskItem[]> = {
    ceo: [],
    discovered: [],
    triaged: [],
    wontdo: [],
  };
  for (const item of items) {
    bySection[item.section]?.push(item);
  }

  const sections: string[] = [];
  for (const [section, sectionItems] of Object.entries(bySection)) {
    if (sectionItems.length === 0) continue;
    const header = SECTION_HEADERS[section];
    const blocks = sectionItems
      .map(
        (item) =>
          `### ${item.id}: ${item.title}\n` +
          `- **Status:** ${item.status}\n` +
          `- **Priority:** ${item.priority ?? "P2"}\n` +
          `- **Type:** ${item.type ?? "feature"}\n`
      )
      .join("\n");
    sections.push(`${header}\n\n${blocks}`);
  }
  return sections.join("\n\n");
}

// Build a minimal file map: state.json + tasks.md; everything else returns ""
function setupFsMock(stateJson: string, backlogMd: string) {
  vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
    const p = filePath as string;
    if (p.endsWith("state.json")) return stateJson;
    if (p.endsWith("tasks.md")) return backlogMd;
    // inbox, changelog, steering — return empty/valid content
    if (p.endsWith("inbox.md")) return "";
    if (p.endsWith("changelog.md")) return "";
    if (p.endsWith("steering.md")) return "";
    throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("readProjectDetail — activeItem enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets activeItem and overrides status to in-progress when task_id matches", async () => {
    const items: TaskItem[] = [
      { id: "T001", title: "Alpha task", status: "planned", section: "triaged", priority: "P1", type: "feature" },
      { id: "T014", title: "Active task", status: "planned", section: "triaged", priority: "P0", type: "bug" },
      { id: "T003", title: "Gamma task", status: "planned", section: "discovered", priority: "P2", type: "chore" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T014")),
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    // activeItem must be non-null and status must be in-progress
    expect(detail.activeItem).not.toBeNull();
    expect(detail.activeItem?.id).toBe("T014");
    expect(detail.activeItem?.status).toBe("in-progress");

    // The same item inside upNext must also have status in-progress
    const upNextActive = detail.upNext.find((i) => i.id === "T014");
    expect(upNextActive).toBeDefined();
    expect(upNextActive?.status).toBe("in-progress");
  });

  it("returns activeItem = null when state.task_id is null", async () => {
    const items: TaskItem[] = [
      { id: "T001", title: "Alpha task", status: "planned", section: "triaged", priority: "P1", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState(null)),
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    expect(detail.activeItem).toBeNull();
    // Original statuses should be unchanged
    expect(detail.upNext.find((i) => i.id === "T001")?.status).toBe("planned");
  });

  it("returns activeItem = null when task_id does not match any item (stale state)", async () => {
    const items: TaskItem[] = [
      { id: "T001", title: "Alpha task", status: "planned", section: "triaged", priority: "P1", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T999")), // stale — T999 not in backlog
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    expect(detail.activeItem).toBeNull();
    // Should not crash and other items unaffected
    expect(detail.upNext).toHaveLength(1);
    expect(detail.upNext[0].status).toBe("planned");
  });

  it("does not mutate the original backlog item object", async () => {
    const items: TaskItem[] = [
      { id: "T014", title: "Active task", status: "planned", section: "triaged", priority: "P0", type: "bug" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T014")),
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    // The enriched copy should have in-progress, but the original literal is untouched
    expect(detail.activeItem?.status).toBe("in-progress");
    // items[0] itself is parsed fresh each call — confirm enriched object is a copy
    expect(detail.activeItem).not.toBe(items[0]);
  });

  it("active item does not appear twice (upNext contains it with correct in-progress status)", async () => {
    const items: TaskItem[] = [
      { id: "T014", title: "Active task", status: "planned", section: "ceo", priority: "P0", type: "bug" },
      { id: "T002", title: "Another task", status: "planned", section: "triaged", priority: "P2", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T014")),
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    const activesInUpNext = detail.upNext.filter((i) => i.id === "T014");
    expect(activesInUpNext).toHaveLength(1);
    expect(activesInUpNext[0].status).toBe("in-progress");
  });

  // T109 — guard against split-brain: a task that is already done/wontdo on disk
  // must not be promoted to in-progress just because state.task_id still
  // references it during the transient post-merge window.
  it("does not promote done task to in-progress when task_id matches", async () => {
    const items: TaskItem[] = [
      { id: "T050", title: "Recently merged task", status: "done", section: "triaged", priority: "P1", type: "feature" },
      { id: "T051", title: "A pending task", status: "pending", section: "triaged", priority: "P2", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T050")), // state still references the just-merged task
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    // activeItem must be null — the done task is no longer "in-progress".
    expect(detail.activeItem).toBeNull();

    // The done task must remain done in the returned task list.
    const t050 = [...detail.upNext, ...detail.recentlyShipped].find((i) => i.id === "T050");
    expect(t050).toBeDefined();
    expect(t050?.status).toBe("done");

    // It must show up in recentlyShipped, not upNext.
    expect(detail.recentlyShipped.some((i) => i.id === "T050")).toBe(true);
    expect(detail.upNext.some((i) => i.id === "T050")).toBe(false);
  });

  it("does not promote wontdo task to in-progress when task_id matches", async () => {
    const items: TaskItem[] = [
      { id: "T060", title: "Rejected task", status: "wontdo", section: "wontdo", priority: "P2", type: "feature" },
      { id: "T061", title: "A planned task", status: "planned", section: "triaged", priority: "P1", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T060")), // stale reference to a wontdo task
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    // activeItem must be null — wontdo tasks should never be promoted.
    expect(detail.activeItem).toBeNull();

    // T061 (planned) is unaffected.
    const t061 = detail.upNext.find((i) => i.id === "T061");
    expect(t061?.status).toBe("planned");

    // T060 must not appear in upNext (wontdo is excluded from upNext).
    expect(detail.upNext.some((i) => i.id === "T060")).toBe(false);
  });

  it("still promotes a pending task with matching task_id to in-progress", async () => {
    // Sanity-check the happy path is preserved alongside the new guard.
    const items: TaskItem[] = [
      { id: "T070", title: "Active pending task", status: "pending", section: "triaged", priority: "P1", type: "feature" },
    ];

    setupFsMock(
      JSON.stringify(makeState("T070")),
      makeBacklogMd(items)
    );

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    expect(detail.activeItem).not.toBeNull();
    expect(detail.activeItem?.id).toBe("T070");
    expect(detail.activeItem?.status).toBe("in-progress");
  });
});

describe("readProjectDetail — cost_usd enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeStateWithCosts(costs: Record<string, number>): RedEyeState {
    return {
      ...makeState(null),
      item_costs: costs,
    } as RedEyeState;
  }

  it("attaches cost_usd to recentlyShipped items when item_costs match", async () => {
    const items: TaskItem[] = [
      { id: "T015", title: "Cost tracking", status: "done", section: "triaged", priority: "P1", type: "feature" },
      { id: "T016", title: "Dark mode", status: "done", section: "triaged", priority: "P2", type: "feature" },
    ];

    const state = makeStateWithCosts({ "T015": 1.42, "T016": 0.38 });

    setupFsMock(JSON.stringify(state), makeBacklogMd(items));

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    const bl015 = detail.recentlyShipped.find((i) => i.id === "T015");
    const bl016 = detail.recentlyShipped.find((i) => i.id === "T016");

    expect(bl015?.cost_usd).toBeCloseTo(1.42);
    expect(bl016?.cost_usd).toBeCloseTo(0.38);
  });

  it("leaves cost_usd undefined for items without matching entry", async () => {
    const items: TaskItem[] = [
      { id: "T015", title: "Cost tracking", status: "done", section: "triaged", priority: "P1", type: "feature" },
      { id: "T016", title: "Dark mode", status: "done", section: "triaged", priority: "P2", type: "feature" },
    ];

    // Only T015 has a cost entry
    const state = makeStateWithCosts({ "T015": 1.42 });

    setupFsMock(JSON.stringify(state), makeBacklogMd(items));

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    const bl015 = detail.recentlyShipped.find((i) => i.id === "T015");
    const bl016 = detail.recentlyShipped.find((i) => i.id === "T016");

    expect(bl015?.cost_usd).toBeCloseTo(1.42);
    expect(bl016?.cost_usd).toBeUndefined();
  });

  it("works when item_costs is absent from state", async () => {
    const items: TaskItem[] = [
      { id: "T015", title: "Cost tracking", status: "done", section: "triaged", priority: "P1", type: "feature" },
    ];

    // State has no item_costs field
    const state = makeState(null);

    setupFsMock(JSON.stringify(state), makeBacklogMd(items));

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    const bl015 = detail.recentlyShipped.find((i) => i.id === "T015");
    expect(bl015?.cost_usd).toBeUndefined();
  });

  it("does not attach cost_usd to non-done items", async () => {
    const items: TaskItem[] = [
      { id: "T015", title: "In progress", status: "in-progress", section: "triaged", priority: "P1", type: "feature" },
      { id: "T016", title: "Planned", status: "planned", section: "triaged", priority: "P2", type: "feature" },
    ];

    const state = makeStateWithCosts({ "T015": 1.42, "T016": 0.38 });

    setupFsMock(JSON.stringify(state), makeBacklogMd(items));

    const detail = await readProjectDetail("/tmp/test-project", mockProject);

    // recentlyShipped only contains done items — neither of these should appear
    expect(detail.recentlyShipped).toHaveLength(0);
  });
});
