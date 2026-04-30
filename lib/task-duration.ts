/**
 * Per-task wall-clock duration computation.
 *
 * Pure function — reads `iteration_log` from a `RedEyeState` and derives
 * how long a given task took, from the iteration that planned it (PLAN
 * phase) until the iteration that merged it (MERGE phase).
 *
 * `iteration_log` timestamps record when each iteration *ended*. We use
 * the prior entry's timestamp as the PLAN-iteration start estimate and
 * the MERGE entry's timestamp as the end. Phase breakdown is best-effort
 * — each iteration's elapsed time is attributed to its dominant (last
 * non-TRIAGE) phase.
 *
 * Never throws — returns nulls on any parse error so callers can render
 * gracefully when the log window does not cover the requested task.
 *
 * See docs/specs/T119-per-task-time-tracking.md for the full rationale.
 */

import type { RedEyeState } from "./redeye-types";
import { TASK_ID_RE } from "./task-id";

export interface PhaseSpan {
  phase: string;
  durationMs: number;
  formattedDuration: string;
}

export interface TaskDurationResult {
  taskId: string;
  durationMs: number | null;
  planStartIso: string | null;
  mergeEndIso: string | null;
  phaseBreakdown: PhaseSpan[];
  formattedDuration: string | null;
  costUsd: number | null;
  hourlyRate: string | null;
}

interface IterationLogEntry {
  iteration: number;
  phases: string[];
  outcome: string;
  next: string;
  timestamp: string;
}

/**
 * Format a millisecond duration as a short human string.
 *
 * Examples: 0 → "0m", 90m → "1h 30m", 25h → "1d 1h", 48h → "2d".
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function emptyResult(taskId: string, costUsd: number | null = null): TaskDurationResult {
  return {
    taskId,
    durationMs: null,
    planStartIso: null,
    mergeEndIso: null,
    phaseBreakdown: [],
    formattedDuration: null,
    costUsd,
    hourlyRate: null,
  };
}

function parseTs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function dominantPhase(phases: string[]): string | null {
  // Pick the last meaningful phase (non-TRIAGE). If only TRIAGE present, return TRIAGE.
  for (let i = phases.length - 1; i >= 0; i--) {
    if (phases[i] !== "TRIAGE") return phases[i];
  }
  return phases.length > 0 ? phases[0] : null;
}

/**
 * Compute wall-clock duration for the given task ID.
 *
 * @param state    parsed RedEye state (may be null when state.json is absent)
 * @param taskId   e.g. "T119"
 * @param costUsd  per-task cost from state.item_costs[taskId]; pass undefined when unknown
 */
export function computeTaskDuration(
  state: RedEyeState | null,
  taskId: string,
  costUsd?: number
): TaskDurationResult {
  const safeCost = costUsd === undefined ? null : costUsd;

  if (!state) return emptyResult(taskId, safeCost);
  if (!TASK_ID_RE.test(taskId)) return emptyResult(taskId, safeCost);

  // iteration_log is read at runtime from state.json — RedEyeState does not
  // declare it explicitly. Cast and default to [] for missing/malformed cases.
  const rawLog = (state as unknown as { iteration_log?: unknown }).iteration_log;
  if (!Array.isArray(rawLog) || rawLog.length === 0) {
    return emptyResult(taskId, safeCost);
  }
  const log = rawLog as IterationLogEntry[];

  const numericPart = taskId.slice(1).replace(/^0+/, "") || "0";
  // Match T<numericPart> as a whole word so T11 doesn't match inside T119.
  const idRe = new RegExp(`\\bT0*${numericPart}\\b`);

  // Find indices of matching entries (mention the task ID anywhere in outcome/next).
  const matchIndices: number[] = [];
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (!entry || typeof entry !== "object") continue;
    const blob = `${entry.outcome ?? ""} ${entry.next ?? ""}`;
    if (idRe.test(blob)) matchIndices.push(i);
  }

  if (matchIndices.length === 0) return emptyResult(taskId, safeCost);

  // PLAN: earliest matching entry whose phases include "PLAN".
  // MERGE: latest matching entry whose phases include "MERGE".
  let planIdx = -1;
  let mergeIdx = -1;
  for (const i of matchIndices) {
    const phases = Array.isArray(log[i].phases) ? log[i].phases : [];
    if (planIdx === -1 && phases.includes("PLAN")) planIdx = i;
    if (phases.includes("MERGE")) mergeIdx = i;
  }

  // PLAN start: use the prior iteration_log entry's timestamp when available;
  // otherwise fall back to PLAN's own timestamp (gives 0 for single-entry case).
  let planStartIso: string | null = null;
  if (planIdx >= 0) {
    const planEntry = log[planIdx];
    const priorEntry = planIdx > 0 ? log[planIdx - 1] : null;
    const candidate = priorEntry?.timestamp ?? planEntry.timestamp;
    planStartIso = parseTs(candidate) !== null ? candidate : null;
  }

  const mergeEndIso =
    mergeIdx >= 0 && parseTs(log[mergeIdx].timestamp) !== null
      ? log[mergeIdx].timestamp
      : null;

  let durationMs: number | null = null;
  if (planStartIso !== null && mergeEndIso !== null) {
    const startMs = parseTs(planStartIso);
    const endMs = parseTs(mergeEndIso);
    if (startMs !== null && endMs !== null) {
      durationMs = Math.max(0, endMs - startMs);
    }
  }

  // Phase breakdown: for each matching iteration entry that has a parseable
  // duration (current entry timestamp - prior entry timestamp), attribute
  // that span to the dominant phase. Aggregate same-phase spans.
  const phaseTotals = new Map<string, number>();
  for (const i of matchIndices) {
    const entry = log[i];
    const priorTs = i > 0 ? parseTs(log[i - 1].timestamp) : null;
    const curTs = parseTs(entry.timestamp);
    if (priorTs === null || curTs === null) continue;
    const span = curTs - priorTs;
    if (span <= 0) continue;
    const phase = dominantPhase(entry.phases ?? []);
    if (!phase) continue;
    phaseTotals.set(phase, (phaseTotals.get(phase) ?? 0) + span);
  }

  const phaseBreakdown: PhaseSpan[] = [];
  for (const [phase, ms] of phaseTotals.entries()) {
    if (ms > 0) {
      phaseBreakdown.push({
        phase,
        durationMs: ms,
        formattedDuration: formatDuration(ms),
      });
    }
  }
  // Stable order: longest spans first.
  phaseBreakdown.sort((a, b) => b.durationMs - a.durationMs);

  const formattedDuration =
    durationMs === null
      ? null
      : durationMs === 0
        ? "< 1m"
        : formatDuration(durationMs);

  let hourlyRate: string | null = null;
  if (
    durationMs !== null &&
    durationMs > 0 &&
    safeCost !== null &&
    safeCost > 0
  ) {
    const hours = durationMs / 3_600_000;
    const rate = safeCost / hours;
    hourlyRate = `$${rate.toFixed(2)}/hr`;
  }

  return {
    taskId,
    durationMs,
    planStartIso,
    mergeEndIso,
    phaseBreakdown,
    formattedDuration,
    costUsd: safeCost,
    hourlyRate,
  };
}
