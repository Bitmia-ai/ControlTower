import { describe, it, expect } from "vitest";
import { computeVelocity, weekKey } from "./velocity";
import type { TaskItem } from "./redeye-types";

function makeTask(
  id: string,
  status: TaskItem["status"],
  mergedAt: string | null
): TaskItem {
  return {
    id,
    title: `Task ${id}`,
    status,
    section: "triaged",
    mergedAt,
  };
}

// Reference "now": Monday 2026-04-27 at 12:00 UTC.
// Current week Sunday = 2026-04-26.
const NOW_MS = Date.UTC(2026, 3, 27, 12, 0, 0);

describe("weekKey", () => {
  it("Monday 2026-04-27 maps to Sunday 2026-04-26", () => {
    expect(weekKey("2026-04-27")).toBe("2026-04-26");
  });

  it("Sunday 2026-04-26 maps to itself", () => {
    expect(weekKey("2026-04-26")).toBe("2026-04-26");
  });

  it("Saturday 2026-04-25 maps to the prior Sunday 2026-04-19", () => {
    expect(weekKey("2026-04-25")).toBe("2026-04-19");
  });
});

describe("computeVelocity", () => {
  it("returns 14 weeks even when there are no completed tasks", () => {
    const result = computeVelocity([], NOW_MS);
    expect(result.weeks.length).toBe(14);
    expect(result.totalCompletedWithDate).toBe(0);
    expect(result.avgTasksPerWeek).toBe(0);
    expect(result.trend).toBe("stable");
    for (const w of result.weeks) {
      expect(w.count).toBe(0);
      expect(w.rollingAvg).toBe(0);
    }
  });

  it("excludes done tasks with mergedAt = null", () => {
    const tasks: TaskItem[] = [
      makeTask("T1", "done", null),
      makeTask("T2", "done", null),
    ];
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.totalCompletedWithDate).toBe(0);
    for (const w of result.weeks) expect(w.count).toBe(0);
  });

  it("excludes non-done tasks even when they have a mergedAt", () => {
    const tasks: TaskItem[] = [
      makeTask("T1", "in-progress", "2026-04-20"),
      makeTask("T2", "blocked", "2026-04-20"),
    ];
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.totalCompletedWithDate).toBe(0);
  });

  it("counts 3 tasks merged in the same week into a single bucket", () => {
    const tasks: TaskItem[] = [
      makeTask("T1", "done", "2026-04-20"), // Mon
      makeTask("T2", "done", "2026-04-22"), // Wed
      makeTask("T3", "done", "2026-04-25"), // Sat
    ];
    const result = computeVelocity(tasks, NOW_MS);
    const week = result.weeks.find((w) => w.weekStart === "2026-04-19");
    expect(week).toBeDefined();
    expect(week?.count).toBe(3);
    expect(result.totalCompletedWithDate).toBe(3);
  });

  it("computes rolling average over a 3-week window", () => {
    // Two tasks merged the week of 2026-04-19 (Sun) — a complete week.
    const tasks: TaskItem[] = [
      makeTask("T1", "done", "2026-04-20"),
      makeTask("T2", "done", "2026-04-21"),
    ];
    const result = computeVelocity(tasks, NOW_MS);
    const idx = result.weeks.findIndex((w) => w.weekStart === "2026-04-19");
    expect(idx).toBeGreaterThan(1);
    // Rolling avg at that index = mean(0, 0, 2) = 0.6666...
    const w = result.weeks[idx];
    expect(w.rollingAvg).toBeCloseTo(2 / 3, 4);
  });

  it("returns trend 'up' when the last 2 weeks far exceed the prior 3", () => {
    // Tasks distributed: 0,0,0 in weeks -5..-3, then 5,5 in weeks -2,-1.
    // current week (-0) is incomplete and excluded.
    const lastWeek = "2026-04-19"; // 1 week before current
    const twoWeeksAgo = "2026-04-12";
    const tasks: TaskItem[] = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(makeTask(`T${i}a`, "done", lastWeek));
      tasks.push(makeTask(`T${i}b`, "done", twoWeeksAgo));
    }
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.trend).toBe("up");
  });

  it("returns trend 'down' when last 2 weeks are far below the prior 3", () => {
    const tasks: TaskItem[] = [];
    // Weeks ago: -5 (2026-03-22), -4 (2026-03-29), -3 (2026-04-05) — 5 each
    // Last 2 complete weeks: -2 (2026-04-12), -1 (2026-04-19) — 0 each
    const heavyWeeks = ["2026-03-22", "2026-03-29", "2026-04-05"];
    for (const day of heavyWeeks) {
      for (let i = 0; i < 5; i++) {
        tasks.push(makeTask(`T${day}-${i}`, "done", day));
      }
    }
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.trend).toBe("down");
  });

  it("returns trend 'stable' when all complete weeks have zero count", () => {
    // 5 tasks merged in the current (incomplete) week only — every other
    // week is empty, so neither up nor down fires.
    const tasks: TaskItem[] = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(makeTask(`T${i}`, "done", "2026-04-26"));
    }
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.trend).toBe("stable");
  });

  it("returns trend 'stable' when last 2 and prior 3 are within 20%", () => {
    const tasks: TaskItem[] = [];
    // 2 tasks per week across last 5 complete weeks → flat.
    const sundays = [
      "2026-03-22",
      "2026-03-29",
      "2026-04-05",
      "2026-04-12",
      "2026-04-19",
    ];
    for (const sun of sundays) {
      tasks.push(makeTask(`Ta-${sun}`, "done", sun));
      tasks.push(makeTask(`Tb-${sun}`, "done", sun));
    }
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.trend).toBe("stable");
  });

  it("only the last week in the array is marked isCurrentWeek", () => {
    const result = computeVelocity([], NOW_MS);
    expect(result.weeks[result.weeks.length - 1].isCurrentWeek).toBe(true);
    for (let i = 0; i < result.weeks.length - 1; i++) {
      expect(result.weeks[i].isCurrentWeek).toBe(false);
    }
  });

  it("avgTasksPerWeek excludes the current incomplete week", () => {
    // 5 tasks merged in the current (incomplete) week — should not contribute
    // to avgTasksPerWeek but should still count toward totalCompletedWithDate.
    const tasks: TaskItem[] = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(makeTask(`T${i}`, "done", "2026-04-26")); // current Sunday
    }
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.avgTasksPerWeek).toBe(0);
    expect(result.totalCompletedWithDate).toBe(5);
  });

  it("totalCompletedWithDate counts only done tasks with non-null mergedAt", () => {
    const tasks: TaskItem[] = [
      makeTask("T1", "done", "2026-04-20"),
      makeTask("T2", "done", null),
      makeTask("T3", "in-progress", "2026-04-20"),
      makeTask("T4", "done", "2026-04-21"),
    ];
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.totalCompletedWithDate).toBe(2);
  });

  it("weekStart values are in chronological (oldest-first) order", () => {
    const result = computeVelocity([], NOW_MS);
    for (let i = 1; i < result.weeks.length; i++) {
      const a = new Date(result.weeks[i - 1].weekStart).getTime();
      const b = new Date(result.weeks[i].weekStart).getTime();
      expect(b).toBeGreaterThan(a);
    }
  });

  it("very old completed tasks are excluded from the chart but included in totalCompletedWithDate", () => {
    const tasks: TaskItem[] = [
      makeTask("T1", "done", "2024-01-01"),
      makeTask("T2", "done", "2026-04-20"),
    ];
    const result = computeVelocity(tasks, NOW_MS);
    expect(result.totalCompletedWithDate).toBe(2);
    // Only T2 should appear in the chart's 14-week window.
    const totalCounted = result.weeks.reduce((sum, w) => sum + w.count, 0);
    expect(totalCounted).toBe(1);
  });
});
