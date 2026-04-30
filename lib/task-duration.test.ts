import { describe, it, expect } from "vitest";
import { computeTaskDuration, formatDuration } from "./task-duration";
import type { RedEyeState } from "./redeye-types";

type IterationLogEntry = {
  iteration: number;
  phases: string[];
  outcome: string;
  next: string;
  timestamp: string;
};

function makeState(log: IterationLogEntry[]): RedEyeState {
  return {
    iteration: log.length,
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
    // iteration_log is part of the wider state schema not enforced by RedEyeState
    // but is read at runtime — cast to satisfy the type.
    ...({ iteration_log: log } as unknown as Partial<RedEyeState>),
  } as RedEyeState;
}

describe("formatDuration", () => {
  it("returns '0m' for zero ms", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("returns 'Xm' for sub-hour durations", () => {
    expect(formatDuration(30 * 60_000)).toBe("30m");
  });

  it("returns 'Xh Ym' for 90 minutes", () => {
    expect(formatDuration(90 * 60_000)).toBe("1h 30m");
  });

  it("returns plain hours when minutes round to 0", () => {
    expect(formatDuration(2 * 3_600_000)).toBe("2h");
  });

  it("returns 'Xd Yh' for >24 hours", () => {
    expect(formatDuration(25 * 3_600_000)).toBe("1d 1h");
  });

  it("returns plain days when remainder hours are 0", () => {
    expect(formatDuration(48 * 3_600_000)).toBe("2d");
  });
});

describe("computeTaskDuration", () => {
  it("returns all-null result when state is null", () => {
    const r = computeTaskDuration(null, "T119");
    expect(r.taskId).toBe("T119");
    expect(r.durationMs).toBeNull();
    expect(r.formattedDuration).toBeNull();
    expect(r.planStartIso).toBeNull();
    expect(r.mergeEndIso).toBeNull();
    expect(r.phaseBreakdown).toEqual([]);
    expect(r.costUsd).toBeNull();
    expect(r.hourlyRate).toBeNull();
  });

  it("returns null durationMs when iteration_log is empty", () => {
    const state = makeState([]);
    const r = computeTaskDuration(state, "T119");
    expect(r.durationMs).toBeNull();
  });

  it("returns null durationMs when taskId is not in any log entry", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE", "PLAN"],
        outcome: "T100 planned",
        next: "BUILD T100",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBeNull();
  });

  it("returns null durationMs when PLAN found but no MERGE", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE", "PLAN"],
        outcome: "T119 plan written",
        next: "BUILD T119",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBeNull();
    expect(r.planStartIso).not.toBeNull();
    expect(r.mergeEndIso).toBeNull();
  });

  it("returns null durationMs when MERGE found but no PLAN", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["MERGE"],
        outcome: "T119 merged",
        next: "TRIAGE",
        timestamp: "2026-04-27T14:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBeNull();
  });

  it("computes duration when PLAN and MERGE in same iteration with prior entry", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "Other work",
        next: "next",
        timestamp: "2026-04-27T09:00:00Z",
      },
      {
        iteration: 2,
        phases: ["TRIAGE", "PLAN", "BUILD", "REVIEW", "DEPLOY", "VERIFY", "MERGE"],
        outcome: "T119 complete",
        next: "TRIAGE",
        timestamp: "2026-04-27T14:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBe(5 * 3_600_000);
    expect(r.formattedDuration).toBe("5h");
    expect(r.planStartIso).toBe("2026-04-27T09:00:00Z");
    expect(r.mergeEndIso).toBe("2026-04-27T14:00:00Z");
  });

  it("computes duration when PLAN in iter N, MERGE in iter N+1", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "previous task",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN", "BUILD"],
        outcome: "T119 plan + build started",
        next: "REVIEW T119",
        timestamp: "2026-04-27T11:00:00Z",
      },
      {
        iteration: 3,
        phases: ["REVIEW", "DEPLOY", "VERIFY", "MERGE"],
        outcome: "T119 merged",
        next: "TRIAGE",
        timestamp: "2026-04-27T14:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // PLAN start = prior entry timestamp = 08:00, MERGE end = 14:00 → 6 hours
    expect(r.durationMs).toBe(6 * 3_600_000);
    expect(r.formattedDuration).toBe("6h");
  });

  it("computes total duration across multiple iterations", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T00:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN"],
        outcome: "T119 planning",
        next: "BUILD T119",
        timestamp: "2026-04-27T02:00:00Z",
      },
      {
        iteration: 3,
        phases: ["BUILD"],
        outcome: "T119 build progress",
        next: "REVIEW T119",
        timestamp: "2026-04-27T05:00:00Z",
      },
      {
        iteration: 4,
        phases: ["REVIEW", "DEPLOY", "VERIFY", "MERGE"],
        outcome: "T119 merged",
        next: "TRIAGE",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // PLAN prev iter timestamp = 00:00 → MERGE 10:00 → 10h
    expect(r.durationMs).toBe(10 * 3_600_000);
  });

  it("does not match T11 when looking up T119 (word boundary check)", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN", "BUILD", "REVIEW", "DEPLOY", "VERIFY", "MERGE"],
        outcome: "T119 done",
        next: "TRIAGE",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T11");
    expect(r.durationMs).toBeNull();
  });

  it("matches T119 when mentioned within longer free-text phrases", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "previous",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN"],
        outcome: "T119 per-task time tracking",
        next: "BUILD",
        timestamp: "2026-04-27T09:00:00Z",
      },
      {
        iteration: 3,
        phases: ["BUILD", "REVIEW", "MERGE"],
        outcome: "MERGE iter 3: T119 shipped",
        next: "TRIAGE",
        timestamp: "2026-04-27T13:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBe(5 * 3_600_000);
  });

  it("rejects taskId that does not match TASK_ID_RE", () => {
    const r = computeTaskDuration(null, "INVALID");
    expect(r.taskId).toBe("INVALID");
    expect(r.durationMs).toBeNull();
  });

  it("clamps negative duration to zero with '< 1m' format", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "later prior",
        next: "next",
        timestamp: "2026-04-27T15:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN"],
        outcome: "T119 plan (clock skew)",
        next: "next",
        timestamp: "2026-04-27T16:00:00Z",
      },
      {
        iteration: 3,
        phases: ["MERGE"],
        outcome: "T119 merge (earlier than plan, clock skew)",
        next: "next",
        timestamp: "2026-04-27T14:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBe(0);
    expect(r.formattedDuration).toBe("< 1m");
  });

  it("computes hourlyRate when both cost and duration are known", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN", "BUILD", "MERGE"],
        outcome: "T119 done",
        next: "next",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    // 2 hours, $4 → $2.00/hr
    const r = computeTaskDuration(makeState(log), "T119", 4);
    expect(r.durationMs).toBe(2 * 3_600_000);
    expect(r.costUsd).toBe(4);
    expect(r.hourlyRate).toBe("$2.00/hr");
  });

  it("returns null hourlyRate when cost is zero", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN", "MERGE"],
        outcome: "T119 done",
        next: "next",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119", 0);
    expect(r.hourlyRate).toBeNull();
  });

  it("phase breakdown attributes single-iter PLAN+BUILD to dominant phase", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["TRIAGE", "PLAN", "BUILD"],
        outcome: "T119 plan + build",
        next: "REVIEW T119",
        timestamp: "2026-04-27T10:00:00Z",
      },
      {
        iteration: 3,
        phases: ["REVIEW", "MERGE"],
        outcome: "T119 merged",
        next: "next",
        timestamp: "2026-04-27T11:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // 2 spans expected: BUILD (2h from iter 2), MERGE (1h from iter 3)
    expect(r.phaseBreakdown.length).toBe(2);
    const phases = r.phaseBreakdown.map((s) => s.phase);
    expect(phases).toContain("BUILD");
    expect(phases).toContain("MERGE");
  });

  it("phase breakdown is empty when only one matching iteration", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN", "BUILD", "MERGE"],
        outcome: "T119 in single iter",
        next: "next",
        timestamp: "2026-04-27T10:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // Only one matching entry → phase breakdown should have <2 spans
    expect(r.phaseBreakdown.length).toBeLessThan(2);
  });

  it("ignores log entries with malformed timestamps", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "not-a-date",
      },
      {
        iteration: 2,
        phases: ["PLAN", "MERGE"],
        outcome: "T119 done",
        next: "next",
        timestamp: "also-bad",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    expect(r.durationMs).toBeNull();
  });

  it("never throws on malformed state", () => {
    expect(() => computeTaskDuration({} as RedEyeState, "T119")).not.toThrow();
  });

  it("uses earliest PLAN entry when multiple exist (re-planning)", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T06:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN"],
        outcome: "T119 first plan",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 3,
        phases: ["PLAN"],
        outcome: "T119 re-plan",
        next: "next",
        timestamp: "2026-04-27T10:00:00Z",
      },
      {
        iteration: 4,
        phases: ["MERGE"],
        outcome: "T119 merge",
        next: "next",
        timestamp: "2026-04-27T12:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // First PLAN was iter 2; prior iter 1 timestamp = 06:00; MERGE = 12:00 → 6h
    expect(r.durationMs).toBe(6 * 3_600_000);
    expect(r.planStartIso).toBe("2026-04-27T06:00:00Z");
  });

  it("uses latest MERGE entry when multiple exist", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["TRIAGE"],
        outcome: "prior",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["PLAN"],
        outcome: "T119 plan",
        next: "next",
        timestamp: "2026-04-27T09:00:00Z",
      },
      {
        iteration: 3,
        phases: ["MERGE"],
        outcome: "T119 first merge",
        next: "next",
        timestamp: "2026-04-27T11:00:00Z",
      },
      {
        iteration: 4,
        phases: ["MERGE"],
        outcome: "T119 second merge after fix",
        next: "next",
        timestamp: "2026-04-27T13:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // PLAN prev = 08:00; latest MERGE = 13:00 → 5h
    expect(r.durationMs).toBe(5 * 3_600_000);
    expect(r.mergeEndIso).toBe("2026-04-27T13:00:00Z");
  });

  it("returns 0 duration when PLAN is the first log entry (no prior timestamp)", () => {
    const log: IterationLogEntry[] = [
      {
        iteration: 1,
        phases: ["PLAN"],
        outcome: "T119 plan (no prior log)",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
      {
        iteration: 2,
        phases: ["MERGE"],
        outcome: "T119 merge",
        next: "next",
        timestamp: "2026-04-27T08:00:00Z",
      },
    ];
    const r = computeTaskDuration(makeState(log), "T119");
    // planStart falls back to PLAN's own ts; merge ts is the same → 0 duration but computable
    expect(r.durationMs).toBe(0);
    expect(r.formattedDuration).toBe("< 1m");
  });
});
