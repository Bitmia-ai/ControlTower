/**
 * Tests for lib/notification-store.ts
 *
 * Covers:
 *   - detectEvents() across all three trigger types
 *   - no-fire on first observation (prev === null)
 *   - no-fire when no relevant change
 *   - ring buffer cap at 50
 *   - hydrateFromFile() handles missing file gracefully
 *   - persistToFile() writes through atomicWriteJson
 *   - getNotificationsSince() integrates the above
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RedEyeState, NotificationItem } from "./redeye-types";

// Mock fs and atomic-write before importing the store under test.
const mockReadFile = vi.fn();
const mockWriteJson = vi.fn();

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    default: { ...actual, readFile: (...a: unknown[]) => mockReadFile(...a) },
    readFile: (...a: unknown[]) => mockReadFile(...a),
  };
});

vi.mock("./atomic-write", () => ({
  atomicWriteJson: (...a: unknown[]) => mockWriteJson(...a),
}));

vi.mock("./redeye-files", () => ({
  safeRedeyePath: (project: string, filename: string) => `${project}/.redeye/${filename}`,
  readState: vi.fn(),
}));

import {
  detectEvents,
  appendEvents,
  hydrateFromFile,
  persistToFile,
  getNotificationsSince,
  __resetNotificationStateForTests,
  RING_BUFFER_CAP,
} from "./notification-store";
import { readState } from "./redeye-files";

const mockReadState = readState as ReturnType<typeof vi.fn>;

function makeState(overrides: Partial<RedEyeState> = {}): RedEyeState {
  return {
    iteration: 1,
    phase: "TRIAGE",
    phase_status: "complete",
    task_id: null,
    task_title: null,
    spec_file: null,
    review_cycles: 0,
    health: {
      confidence: "HIGH",
      env_status: "healthy",
      iterations_since_last_deploy: 0,
      questions_awaiting_ceo: 0,
      blocked_items_count: 0,
    },
    counters: { next_task_id: 1, next_q_id: 1 },
    ...overrides,
  };
}

describe("detectEvents", () => {
  it("returns no events on first observation (prev === null)", () => {
    const events = detectEvents(null, makeState({ phase: "MERGE", phase_status: "complete" }), 0, "p");
    expect(events).toEqual([]);
  });

  it("fires task-complete when MERGE newly completes", () => {
    const prev = makeState({ phase: "DEPLOY", phase_status: "complete" });
    const next = makeState({ phase: "MERGE", phase_status: "complete", task_id: "T113" });
    const events = detectEvents(prev, next, 0, "haze");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("task-complete");
    expect(events[0].message).toContain("T113");
    expect(events[0].message).toContain("complete");
    expect(events[0].projectName).toBe("haze");
    expect(events[0].projectId).toBe(0);
    expect(events[0].taskId).toBe("T113");
  });

  it("does not re-fire task-complete when staying in MERGE/complete", () => {
    const prev = makeState({ phase: "MERGE", phase_status: "complete", task_id: "T113" });
    const next = makeState({ phase: "MERGE", phase_status: "complete", task_id: "T113" });
    expect(detectEvents(prev, next, 0, "p")).toEqual([]);
  });

  it("fires task-error when entering STABILIZE from any other phase", () => {
    const prev = makeState({ phase: "BUILD" });
    const next = makeState({ phase: "STABILIZE" });
    const events = detectEvents(prev, next, 1, "p");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("task-error");
  });

  it("does not re-fire task-error when staying in STABILIZE", () => {
    const prev = makeState({ phase: "STABILIZE", phase_status: "in-progress" });
    const next = makeState({ phase: "STABILIZE", phase_status: "complete" });
    expect(detectEvents(prev, next, 0, "p")).toEqual([]);
  });

  it("fires needs-input when questions_awaiting_ceo increments", () => {
    const prev = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 0 } });
    const next = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 2 } });
    const events = detectEvents(prev, next, 0, "p");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("needs-input");
    expect(events[0].message).toContain("2 new questions");
  });

  it("uses singular form when one new question arrives", () => {
    const prev = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 0 } });
    const next = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 1 } });
    const events = detectEvents(prev, next, 0, "p");
    expect(events[0].message).toMatch(/1 new question\b/);
  });

  it("does not fire needs-input when questions decrement", () => {
    const prev = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 2 } });
    const next = makeState({ health: { ...makeState().health, questions_awaiting_ceo: 1 } });
    expect(detectEvents(prev, next, 0, "p")).toEqual([]);
  });

  it("can fire multiple events in one diff", () => {
    const prev = makeState({ phase: "BUILD", health: { ...makeState().health, questions_awaiting_ceo: 0 } });
    const next = makeState({
      phase: "STABILIZE",
      health: { ...makeState().health, questions_awaiting_ceo: 1 },
    });
    const events = detectEvents(prev, next, 0, "p");
    expect(events.map((e) => e.type).sort()).toEqual(["needs-input", "task-error"]);
  });
});

describe("appendEvents + ring buffer", () => {
  beforeEach(() => {
    __resetNotificationStateForTests();
    mockWriteJson.mockReset();
    mockWriteJson.mockResolvedValue(undefined);
  });

  it("appends events to the buffer", async () => {
    const events: NotificationItem[] = [
      {
        id: "a", type: "task-complete", projectId: 0, projectName: "p",
        message: "x", timestamp: new Date().toISOString(), taskId: null,
      },
    ];
    await appendEvents("/project", events);
    // Internal buffer surfaced via getNotificationsSince
    const all = await getNotificationsSince("/project", 0, "p", 0, /* skipDiff */ true);
    expect(all.map((e) => e.id)).toContain("a");
  });

  it("trims buffer to RING_BUFFER_CAP", async () => {
    const events: NotificationItem[] = Array.from({ length: RING_BUFFER_CAP + 10 }, (_, i) => ({
      id: `e${i}`,
      type: "task-complete" as const,
      projectId: 0,
      projectName: "p",
      message: `m${i}`,
      timestamp: new Date(Date.now() + i).toISOString(),
      taskId: null,
    }));
    await appendEvents("/project", events);
    const all = await getNotificationsSince("/project", 0, "p", 0, /* skipDiff */ true);
    expect(all).toHaveLength(RING_BUFFER_CAP);
    // Oldest 10 dropped — first item should be e10
    expect(all[0].id).toBe("e10");
  });
});

describe("hydrateFromFile", () => {
  beforeEach(() => {
    __resetNotificationStateForTests();
    mockReadFile.mockReset();
  });

  it("returns empty array when file missing (ENOENT)", async () => {
    mockReadFile.mockRejectedValueOnce(Object.assign(new Error("no"), { code: "ENOENT" }));
    const result = await hydrateFromFile("/project");
    expect(result).toEqual([]);
  });

  it("returns parsed array when file present", async () => {
    const items: NotificationItem[] = [
      { id: "a", type: "task-complete", projectId: 0, projectName: "p", message: "x", timestamp: "2026-04-27T00:00:00Z", taskId: null },
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(items));
    const result = await hydrateFromFile("/project");
    expect(result).toEqual(items);
  });

  it("returns empty array on malformed JSON", async () => {
    mockReadFile.mockResolvedValueOnce("not json");
    const result = await hydrateFromFile("/project");
    expect(result).toEqual([]);
  });
});

describe("persistToFile", () => {
  beforeEach(() => {
    __resetNotificationStateForTests();
    mockWriteJson.mockReset();
    mockWriteJson.mockResolvedValue(undefined);
  });

  it("writes JSON via atomicWriteJson", async () => {
    const items: NotificationItem[] = [
      { id: "a", type: "task-complete", projectId: 0, projectName: "p", message: "x", timestamp: "2026-04-27T00:00:00Z", taskId: null },
    ];
    await persistToFile("/project", items);
    expect(mockWriteJson).toHaveBeenCalledOnce();
    const [target, payload] = mockWriteJson.mock.calls[0];
    expect(target).toBe("/project/.redeye/notifications.json");
    expect(JSON.parse(payload)).toEqual(items);
  });
});

describe("getNotificationsSince", () => {
  beforeEach(() => {
    __resetNotificationStateForTests();
    mockReadFile.mockReset();
    mockReadFile.mockRejectedValue(Object.assign(new Error("no"), { code: "ENOENT" }));
    mockWriteJson.mockReset();
    mockWriteJson.mockResolvedValue(undefined);
    mockReadState.mockReset();
  });

  it("returns events with timestamp > since", async () => {
    // Seed buffer
    await appendEvents("/project", [
      { id: "old", type: "task-complete", projectId: 0, projectName: "p", message: "old", timestamp: "2026-04-27T00:00:00.000Z", taskId: null },
      { id: "new", type: "task-complete", projectId: 0, projectName: "p", message: "new", timestamp: "2026-04-27T01:00:00.000Z", taskId: null },
    ]);
    mockReadState.mockResolvedValue(null);
    const sinceMs = new Date("2026-04-27T00:30:00.000Z").getTime();
    const result = await getNotificationsSince("/project", 0, "p", sinceMs);
    expect(result.map((e) => e.id)).toEqual(["new"]);
  });

  it("on first call hydrates from file before diffing", async () => {
    mockReadFile.mockReset();
    const seeded: NotificationItem[] = [
      { id: "seed", type: "task-complete", projectId: 0, projectName: "p", message: "x", timestamp: "2026-04-27T00:00:00Z", taskId: null },
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(seeded));
    mockReadState.mockResolvedValue(null);
    const result = await getNotificationsSince("/project", 0, "p", 0);
    expect(result.map((e) => e.id)).toContain("seed");
  });

  it("does not fire events on first observation (prev snapshot is null)", async () => {
    mockReadState.mockResolvedValue(makeState({ phase: "MERGE", phase_status: "complete" }));
    const result = await getNotificationsSince("/project", 0, "p", 0);
    expect(result).toEqual([]);
  });

  it("fires events on second observation when state changed", async () => {
    // First call seeds prev snapshot
    mockReadState.mockResolvedValueOnce(makeState({ phase: "BUILD" }));
    await getNotificationsSince("/project", 0, "p", 0);
    // Second call: phase changes to MERGE/complete
    mockReadState.mockResolvedValueOnce(makeState({ phase: "MERGE", phase_status: "complete", task_id: "T113" }));
    const result = await getNotificationsSince("/project", 0, "p", 0);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("task-complete");
    expect(mockWriteJson).toHaveBeenCalled();
  });
});
