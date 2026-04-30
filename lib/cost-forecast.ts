/**
 * Cost forecasting: compute a project's burn rate, trend direction, and
 * a 5-point projection from the existing JSONL transcript history.
 *
 * Pure computation; the only I/O happens inside `getSessionCostHistory`.
 * Never throws — returns safe zeros if the history call fails.
 *
 * See docs/specs/T117-cost-forecasting.md for the full design rationale.
 */

import { getSessionCostHistory, type SessionCostEntry } from "./cost-history";

const ONE_DAY_MS = 86_400_000;

/** Number of forward points the projection always produces. */
const PROJECTION_POINTS = 5;

/** Rolling-window size for the burn-rate average (capped by available data). */
const BURN_RATE_WINDOW = 7;

/** Default sessions/day estimate when fewer than 2 sessions are available. */
const DEFAULT_SESSIONS_PER_DAY = 3;

/** Lower / upper clamps on the sessions/day heuristic. */
const SESSIONS_PER_DAY_MIN = 0.5;
const SESSIONS_PER_DAY_MAX = 24;

/** Trend detection threshold: 15% delta against the prior baseline. */
const TREND_DELTA = 0.15;

export type ForecastTrend = "accelerating" | "decelerating" | "stable";

export interface ProjectedPoint {
  sessionIndex: number;
  cost: number;
}

export interface ForecastResult {
  sessions: SessionCostEntry[];
  burnRatePerSession: number;
  trend: ForecastTrend;
  forecast24h: number;
  forecast7d: number;
  sessionsPerDay: number;
  projectedSessions: ProjectedPoint[];
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

function detectTrend(costs: number[]): ForecastTrend {
  // Need both a "recent" window (last 3) and a baseline (next 4 prior) to
  // make any meaningful comparison. With fewer than 4 sessions, we cannot
  // distinguish trend direction reliably, so call it stable.
  if (costs.length < 4) return "stable";

  const recent = costs.slice(-3);
  const baseStart = Math.max(0, costs.length - 7);
  const baseEnd = costs.length - 3;
  const base = costs.slice(baseStart, baseEnd);
  if (base.length === 0) return "stable";

  const recentAvg = average(recent);
  const baseAvg = average(base);
  if (baseAvg === 0) return "stable";

  if (recentAvg > baseAvg * (1 + TREND_DELTA)) return "accelerating";
  if (recentAvg < baseAvg * (1 - TREND_DELTA)) return "decelerating";
  return "stable";
}

function computeSessionsPerDay(sessions: SessionCostEntry[]): number {
  if (sessions.length < 2) return DEFAULT_SESSIONS_PER_DAY;

  // Use the last min(7, n) sessions for a stable cadence estimate.
  const window = sessions.slice(-Math.min(BURN_RATE_WINDOW, sessions.length));
  const first = window[0].mtimeMs;
  const last = window[window.length - 1].mtimeMs;
  const daySpan = (last - first) / ONE_DAY_MS;

  if (daySpan <= 0) return SESSIONS_PER_DAY_MAX;

  const rate = window.length / daySpan;
  if (rate < SESSIONS_PER_DAY_MIN) return SESSIONS_PER_DAY_MIN;
  if (rate > SESSIONS_PER_DAY_MAX) return SESSIONS_PER_DAY_MAX;
  return rate;
}

function emptyResult(): ForecastResult {
  return {
    sessions: [],
    burnRatePerSession: 0,
    trend: "stable",
    forecast24h: 0,
    forecast7d: 0,
    sessionsPerDay: 0,
    projectedSessions: [],
  };
}

/**
 * Compute a forecast envelope for the given project path.
 *
 * `sessionLimit` controls how many recent JSONL sessions are read (default 10).
 *
 * Never throws: any I/O error from the underlying history scan returns the
 * empty/zero envelope so the API surface stays stable even when transcripts
 * are missing.
 */
export async function computeCostForecast(
  projectPath: string,
  sessionLimit = 10
): Promise<ForecastResult> {
  let sessions: SessionCostEntry[];
  try {
    sessions = await getSessionCostHistory(projectPath, sessionLimit);
  } catch {
    return emptyResult();
  }

  if (sessions.length === 0) return emptyResult();

  const costs = sessions.map((s) => s.cost);
  const window = costs.slice(-Math.min(BURN_RATE_WINDOW, costs.length));
  const burnRatePerSession = average(window);

  const trend = detectTrend(costs);
  const sessionsPerDay = computeSessionsPerDay(sessions);

  const forecast24h = burnRatePerSession * sessionsPerDay;
  const forecast7d = forecast24h * 7;

  const lastIndex = sessions.length;
  const projectedSessions: ProjectedPoint[] = [];
  for (let i = 0; i < PROJECTION_POINTS; i++) {
    projectedSessions.push({
      sessionIndex: lastIndex + i,
      cost: burnRatePerSession,
    });
  }

  return {
    sessions,
    burnRatePerSession,
    trend,
    forecast24h,
    forecast7d,
    sessionsPerDay,
    projectedSessions,
  };
}
