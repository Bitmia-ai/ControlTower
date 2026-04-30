"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type {
  SessionHistoryEntry,
  IterationSummary,
} from "@/lib/cost-history";
import { PhaseChip } from "./phase-chip";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Format a millisecond duration into a human-friendly string.
 * - `< 1 min` for anything below 60_000ms
 * - `42 min` for sub-hour durations
 * - `1h 23m` for hour+ durations
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1 min";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours}h ${minutes}m`;
}

/**
 * Convert a phase token like "TRIAGE" → "Triage" so the collapsed row reads
 * as plain English ("Triage → Plan → Build") instead of cryptic abbreviations.
 * See spec T121 / AD-2 for the rationale.
 */
export function toTitleCase(phase: string): string {
  if (!phase) return "";
  return phase.charAt(0).toUpperCase() + phase.slice(1).toLowerCase();
}

function formatCost(cost: number): string {
  if (cost > 0 && cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

const TASK_LINE_MAX = 60;
const TASK_ID_RE = /\bT\d+\b/;

/**
 * Build a compact one-line headline for the collapsed row from a list of
 * iteration summaries. Prefers entries whose outcome mentions a task ID
 * (e.g. "T128") and formats them as "T128 · short outcome…".
 *
 * Returns null when summaries is undefined / empty.
 *
 * Spec T128 / AD-5.
 */
export function extractTaskLine(
  summaries: IterationSummary[] | undefined | null
): string | null {
  if (!summaries || summaries.length === 0) return null;

  // Prefer the first summary whose outcome mentions a task ID (T\d+).
  const withTaskId = summaries.find((s) => TASK_ID_RE.test(s.outcome));
  if (withTaskId) {
    const match = withTaskId.outcome.match(TASK_ID_RE);
    const taskId = match ? match[0] : "";
    // Strip task-ID prefix noise so the headline reads cleanly:
    //   "T126 complete. RunButton …" → "RunButton …"
    let rest = withTaskId.outcome
      .replace(new RegExp(`\\b${taskId}\\b[\\s:.\\-—]*(?:complete|done)?[\\s:.\\-—]*`), "")
      .trim();
    if (!rest) rest = withTaskId.outcome.trim();
    if (rest.length > TASK_LINE_MAX) rest = rest.slice(0, TASK_LINE_MAX).trimEnd() + "…";
    return `${taskId} · ${rest}`;
  }

  // Fallback: first outcome string truncated.
  const first = summaries[0]?.outcome?.trim() ?? "";
  if (!first) return null;
  if (first.length > TASK_LINE_MAX) return first.slice(0, TASK_LINE_MAX).trimEnd() + "…";
  return first;
}

interface SessionHistoryRowProps {
  entry: SessionHistoryEntry;
  /**
   * Optional 1-based descending index (newest = 1) used to render a
   * "Session #N" prefix badge. Spec T121 / AD-3 — derives a meaningful
   * reference label without exposing the UUID filename.
   */
  sessionNumber?: number;
}

/**
 * SessionHistoryRow — collapsed row design (T121 / ST-1 mockup):
 *
 *   ▶  [Session #N]  Apr 28, 2026  2:15 PM     Triage → Plan → Build   $1.42
 *                    2h 15m
 *
 * Expanded panel adds: Started/Ended timestamps, full PhaseChip strip,
 * and a de-emphasized "Debug: session file" footnote with the UUID.
 *
 * Design rationale: per spec AD-4, the UUID is a debug artifact. Hiding it
 * from the collapsed row and surfacing the phase flow as plain English
 * makes the section legible to non-technical viewers.
 */
export function SessionHistoryRow({ entry, sessionNumber }: SessionHistoryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const phaseFlow =
    entry.phases.length === 0 ? "" : entry.phases.map(toTitleCase).join(" → ");
  const phasesAriaLabel =
    entry.phases.length === 0
      ? "Phases: none"
      : `Phases: ${entry.phases.join(" ")}`;
  const taskLine = extractTaskLine(entry.iterationSummaries);
  const summaries = entry.iterationSummaries ?? [];

  return (
    <div
      className={`border-l-2 transition-colors ${
        expanded
          ? "border-l-red-500 dark:border-l-red-600"
          : "border-l-transparent hover:border-l-red-400 dark:hover:border-l-red-500"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex flex-wrap items-center gap-2 sm:gap-4 py-3 px-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
        aria-expanded={expanded}
      >
        {/* Expand chevron */}
        <span className="flex-shrink-0 text-gray-400 dark:text-zinc-600">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </span>

        {/* Optional Session #N reference badge — never exposes the UUID */}
        {sessionNumber !== undefined && (
          <span className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded px-1.5 py-0.5 tabular-nums">
            Session #{sessionNumber}
          </span>
        )}

        {/* Date + duration */}
        <div className="flex flex-col min-w-0 flex-shrink-0 w-40">
          <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
            {dateFormatter.format(new Date(entry.startedAt))}
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-500">
            {formatDuration(entry.durationMs)}
          </span>
        </div>

        {/* Plain-English phase flow ("Triage → Plan → Build") + optional task line */}
        <div
          className="flex-1 min-w-0 overflow-hidden"
          aria-label={phasesAriaLabel}
        >
          {phaseFlow === "" ? (
            <span
              className="text-xs text-gray-400 dark:text-zinc-600"
              title="No phase data"
            >
              —
            </span>
          ) : (
            <span className="block text-xs text-gray-600 dark:text-zinc-400 truncate">
              {phaseFlow}
            </span>
          )}
          {taskLine && (
            <span
              data-testid="session-task-line"
              className="block text-[11px] text-gray-500 dark:text-zinc-500 truncate mt-0.5"
              title={taskLine}
            >
              {taskLine}
            </span>
          )}
        </div>

        {/* Cost badge */}
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 tabular-nums">
            {formatCost(entry.cost)}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-10 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800 space-y-2">
          {/* Full phase chip strip — power-user view */}
          {entry.phases.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-zinc-600 mb-1">
                All phases ({entry.phases.length})
              </p>
              <div
                className="flex flex-wrap gap-1"
                aria-label={`All phases: ${entry.phases.join(" ")}`}
              >
                {entry.phases.map((phase, i) => (
                  <PhaseChip key={`${phase}-${i}`} phase={phase} />
                ))}
              </div>
            </div>
          )}
          {/* Activity — what shipped each iteration in this session window */}
          {summaries.length > 0 && (
            <div data-testid="session-activity">
              <p className="text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-zinc-600 mb-1">
                Activity ({summaries.length} iteration
                {summaries.length > 1 ? "s" : ""})
              </p>
              <div className="space-y-1.5">
                {summaries.map((s) => (
                  <div key={s.iteration}>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500">
                      Iteration {s.iteration}
                      {s.phases.length > 0 && (
                        <> · {s.phases.map(toTitleCase).join(" → ")}</>
                      )}
                    </p>
                    <p className="text-xs text-gray-700 dark:text-zinc-300 leading-snug">
                      {s.outcome}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Timing: started → ended */}
          <p className="text-xs text-gray-500 dark:text-zinc-500">
            <span className="text-gray-700 dark:text-zinc-300">Started:</span>{" "}
            {dateFormatter.format(new Date(entry.startedAt))}
            {entry.durationMs > 0 && (
              <>
                {" · "}
                <span className="text-gray-700 dark:text-zinc-300">Ended:</span>{" "}
                {dateFormatter.format(new Date(entry.startedAt + entry.durationMs))}
              </>
            )}
          </p>
          {/* UUID filename — debug artifact, smallest most de-emphasized element */}
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 font-mono">
            <span className="text-gray-500 dark:text-zinc-500 not-italic">
              Debug: session file
            </span>{" "}
            <span className="truncate inline-block max-w-full align-bottom" title={entry.file}>
              {entry.file}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
