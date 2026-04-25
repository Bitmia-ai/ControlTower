"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SessionHistoryEntry } from "@/lib/cost-history";
import { PhaseChip } from "./phase-chip";

const MAX_VISIBLE_CHIPS = 8;

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

function formatCost(cost: number): string {
  if (cost > 0 && cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function SessionHistoryRow({ entry }: { entry: SessionHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);
  const visiblePhases = entry.phases.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = entry.phases.length - visiblePhases.length;
  const phasesAriaLabel =
    entry.phases.length === 0
      ? "Phases: none"
      : `Phases: ${entry.phases.join(" ")}`;

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
        className="w-full flex items-center gap-4 py-3 px-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
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

        {/* Date + duration */}
        <div className="flex flex-col min-w-0 flex-shrink-0 w-40">
          <span className="text-sm text-gray-900 dark:text-zinc-100 truncate">
            {dateFormatter.format(new Date(entry.startedAt))}
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-500">
            {formatDuration(entry.durationMs)}
          </span>
        </div>

        {/* Phase chips */}
        <div
          className="flex-1 flex flex-wrap items-center gap-1 min-w-0"
          aria-label={phasesAriaLabel}
        >
          {entry.phases.length === 0 ? (
            <span className="text-xs text-gray-400 dark:text-zinc-600" title="No phase data">
              —
            </span>
          ) : (
            <>
              {visiblePhases.map((phase, i) => (
                <PhaseChip key={`${phase}-${i}`} phase={phase} />
              ))}
              {overflow > 0 && (
                <span className="text-[10px] text-gray-500 dark:text-zinc-500 font-medium">
                  +{overflow} more
                </span>
              )}
            </>
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
        <div className="px-10 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
          <p className="text-xs text-gray-500 dark:text-zinc-500 font-mono truncate">{entry.file}</p>
        </div>
      )}
    </div>
  );
}
