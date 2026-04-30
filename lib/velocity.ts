/**
 * Velocity computation: groups completed tasks by calendar week (Sunday-aligned),
 * computes a 3-week rolling average and a trend direction.
 *
 * Pure function — no I/O, no side effects. Easily unit-testable by passing
 * a fixed `tasks` array and an injectable `nowMs`.
 *
 * See docs/specs/T118-velocity-chart.md for design rationale (AD-1..AD-7).
 */

import type { TaskItem } from "./redeye-types";

const ONE_DAY_MS = 86_400_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** Number of weeks rendered in the chart, including the current week. */
const WEEKS_WINDOW = 14;

/** Trend detection threshold: 20% delta vs. the prior baseline (per AD-3). */
const TREND_DELTA = 0.2;

export interface VelocityWeek {
  /** ISO date of the Sunday that starts this week, e.g. "2026-04-20" */
  weekStart: string;
  /** Number of tasks completed (mergedAt falls within this week) */
  count: number;
  /** 3-week rolling average count (may be fractional) */
  rollingAvg: number;
  /** Whether this is the current (potentially incomplete) week */
  isCurrentWeek: boolean;
}

export interface VelocityResult {
  /** Last 14 calendar weeks, oldest first */
  weeks: VelocityWeek[];
  /** Mean tasks/week over the entire returned window (excluding current week) */
  avgTasksPerWeek: number;
  /** "up" | "down" | "stable" — derived from last 2 vs prior 3–5 complete weeks */
  trend: "up" | "down" | "stable";
  /** Total completed tasks with a known mergedAt date */
  totalCompletedWithDate: number;
}

/**
 * Convert an ISO date string (YYYY-MM-DD) to the ISO date string of the
 * Sunday that starts the same calendar week (UTC, Sunday-aligned).
 *
 * Uses noon UTC as the reference instant to avoid DST and timezone edges.
 */
export function weekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const sunday = new Date(d.getTime() - dayOfWeek * ONE_DAY_MS);
  return sunday.toISOString().slice(0, 10);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

/**
 * Compute weekly velocity over the last 14 weeks ending at `nowMs`.
 *
 * Only tasks with `status === "done"` and a non-null `mergedAt` are counted.
 * Tasks merged outside the 14-week window are excluded from the chart but
 * still contribute to `totalCompletedWithDate`.
 */
export function computeVelocity(
  tasks: TaskItem[],
  nowMs: number = Date.now()
): VelocityResult {
  // Filter to done tasks with a real mergedAt date.
  const completed = tasks.filter(
    (t) => t.status === "done" && typeof t.mergedAt === "string" && t.mergedAt
  );
  const totalCompletedWithDate = completed.length;

  // Bucket counts keyed by week-start (Sunday) ISO date.
  const counts = new Map<string, number>();
  for (const t of completed) {
    const key = weekKey(t.mergedAt as string);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Build the 14-week window ending on the current week's Sunday.
  const now = new Date(nowMs);
  const todayDayOfWeek = now.getUTCDay();
  const currentSundayMs =
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ) - todayDayOfWeek * ONE_DAY_MS;

  const rawWeeks: { weekStart: string; count: number }[] = [];
  for (let i = WEEKS_WINDOW - 1; i >= 0; i--) {
    const sundayMs = currentSundayMs - i * ONE_WEEK_MS;
    const weekStart = new Date(sundayMs).toISOString().slice(0, 10);
    rawWeeks.push({ weekStart, count: counts.get(weekStart) ?? 0 });
  }

  // 3-week rolling average: mean of [i-2, i-1, i] (clamped at the start).
  const weeks: VelocityWeek[] = rawWeeks.map((w, i) => {
    const start = Math.max(0, i - 2);
    const window = rawWeeks.slice(start, i + 1).map((r) => r.count);
    return {
      weekStart: w.weekStart,
      count: w.count,
      rollingAvg: average(window),
      isCurrentWeek: i === rawWeeks.length - 1,
    };
  });

  // Average tasks/week excludes the current (incomplete) week.
  const completeWeeks = weeks.slice(0, weeks.length - 1);
  const avgTasksPerWeek = average(completeWeeks.map((w) => w.count));

  // Trend: compare last 2 complete weeks against the 3 weeks before them.
  // Require at least 3 complete weeks before emitting an up/down signal.
  let trend: "up" | "down" | "stable" = "stable";
  if (completeWeeks.length >= 3) {
    const last2 = completeWeeks.slice(-2);
    const prior = completeWeeks.slice(
      Math.max(0, completeWeeks.length - 5),
      completeWeeks.length - 2
    );
    const recentAvg = average(last2.map((w) => w.count));
    const baseAvg = average(prior.map((w) => w.count));
    if (baseAvg === 0) {
      if (recentAvg > 0) trend = "up";
      // else stable (no signal — both zero)
    } else if (recentAvg > baseAvg * (1 + TREND_DELTA)) {
      trend = "up";
    } else if (recentAvg < baseAvg * (1 - TREND_DELTA)) {
      trend = "down";
    }
  }

  return {
    weeks,
    avgTasksPerWeek,
    trend,
    totalCompletedWithDate,
  };
}
