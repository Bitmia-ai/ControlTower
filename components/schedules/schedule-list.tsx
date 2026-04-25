"use client";

import { useState } from "react";
import type { ScheduleEntry } from "@/lib/redeye-types";

// ---------------------------------------------------------------------------
// Relative time helper (no date-fns dependency)
// ---------------------------------------------------------------------------

function formatRelativeTime(ms: number | null, nowMs: number = Date.now()): string {
  if (ms === null) return "—";

  const diffMs = nowMs - ms;
  const absDiff = Math.abs(diffMs);
  const future = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(absDiff / (60 * 1000));
  const hours = Math.floor(absDiff / (3600 * 1000));
  const days = Math.floor(absDiff / (86400 * 1000));
  const weeks = Math.floor(absDiff / (7 * 86400 * 1000));

  let label: string;
  if (seconds < 60) {
    label = "just now";
  } else if (minutes < 60) {
    label = `${minutes} minute${minutes !== 1 ? "s" : ""} ${future ? "from now" : "ago"}`;
  } else if (hours < 24) {
    label = `${hours} hour${hours !== 1 ? "s" : ""} ${future ? "from now" : "ago"}`;
  } else if (days < 14) {
    label = `${days} day${days !== 1 ? "s" : ""} ${future ? "from now" : "ago"}`;
  } else {
    label = `${weeks} week${weeks !== 1 ? "s" : ""} ${future ? "from now" : "ago"}`;
  }

  return label;
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ entry }: { entry: ScheduleEntry }) {
  if (entry.lastRunIso === null && entry.nextDueMs !== null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        Never run
      </span>
    );
  }
  if (entry.isOverdue) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
        Overdue
      </span>
    );
  }
  if (entry.nextDueMs === null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400">
        Unknown schedule
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      On schedule
    </span>
  );
}

// ---------------------------------------------------------------------------
// RunButton
// ---------------------------------------------------------------------------

type RunState = "idle" | "loading" | "success" | "error";

function RunButton({
  scheduleId,
  projectId,
}: {
  scheduleId: string;
  projectId: string;
}) {
  const [runState, setRunState] = useState<RunState>("idle");

  async function handleRun(e: React.MouseEvent) {
    e.stopPropagation();
    if (runState === "loading") return;
    setRunState("loading");
    try {
      const res = await fetch(`/api/projects/${projectId}/schedules/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error("Run schedule failed:", json.error);
        setRunState("error");
      } else {
        setRunState("success");
      }
    } catch {
      setRunState("error");
    }

    // Reset back to idle after 3 seconds
    setTimeout(() => setRunState("idle"), 3000);
  }

  const label =
    runState === "loading"
      ? "Queuing…"
      : runState === "success"
        ? "Queued ✓"
        : runState === "error"
          ? "Failed ✗"
          : "Run now";

  const colorClass =
    runState === "success"
      ? "text-green-600 dark:text-green-400"
      : runState === "error"
        ? "text-red-600 dark:text-red-400"
        : "text-blue-600 dark:text-blue-400 hover:underline";

  return (
    <button
      type="button"
      aria-label={`Run schedule ${scheduleId} now`}
      disabled={runState === "loading"}
      onClick={handleRun}
      className={`text-xs font-medium transition-colors disabled:cursor-not-allowed ${colorClass}`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ScheduleRow
// ---------------------------------------------------------------------------

function ScheduleRow({
  entry,
  projectId,
}: {
  entry: ScheduleEntry;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const nowMs = Date.now();

  const lastRunLabel = entry.lastRunIso
    ? formatRelativeTime(Date.parse(entry.lastRunIso), nowMs)
    : "Never";

  const nextDueLabel = entry.nextDueMs !== null
    ? formatRelativeTime(entry.nextDueMs, nowMs)
    : "—";

  // Top status border: amber for overdue, zinc for never-run, green for on-schedule.
  const topBorder = entry.isOverdue
    ? "border-t-amber-400"
    : entry.lastRunIso === null
    ? "border-t-zinc-300 dark:border-t-zinc-700"
    : "border-t-green-500";

  return (
    <div
      className={`rounded-lg border border-t-[3px] ${topBorder} transition-colors ${
        entry.isOverdue
          ? "border-gray-200 dark:border-zinc-800 bg-red-50 dark:bg-red-950/10"
          : "border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
      }`}
    >
      {/* Header row: expand button (left/center) + action buttons (right).
          RunButton is a sibling of the expand button, not nested inside it,
          to avoid the invalid nested <button> HTML structure. */}
      <div className="flex items-start gap-2 px-4 py-3 min-h-[44px]">
        {/* Expand button — takes up all remaining space */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} schedule ${entry.id}: ${entry.title}`}
          onClick={() => setExpanded((e) => !e)}
          className="flex-1 text-left flex items-start gap-3 min-w-0"
        >
          {/* Expand chevron */}
          <svg
            className={`mt-0.5 flex-shrink-0 h-4 w-4 text-gray-400 dark:text-zinc-500 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-500 dark:text-zinc-500">
                {entry.id}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                {entry.title}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-400 dark:text-zinc-600">freq</span>
                <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-zinc-300">
                  {entry.frequency || "—"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span>Last run:</span>
                <span>{lastRunLabel}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  entry.isOverdue
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : ""
                }`}
              >
                <span>Next:</span>
                <span>{nextDueLabel}</span>
              </span>
            </div>
          </div>
        </button>

        {/* Status badge + roles + run button — siblings of the expand button */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge entry={entry} />
          {entry.assignedTo && (
            <span className="text-xs text-gray-400 dark:text-zinc-600">
              {entry.assignedTo}
            </span>
          )}
          <RunButton scheduleId={entry.id} projectId={projectId} />
        </div>
      </div>

      {/* Expanded steps */}
      {expanded && entry.steps.length > 0 && (
        <div className="px-4 pb-3 ml-7 border-t border-gray-100 dark:border-zinc-800 pt-2">
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-500 mb-1.5">
            Steps
          </p>
          <ol className="list-decimal list-inside space-y-1">
            {entry.steps.map((step, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-zinc-300">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {expanded && entry.steps.length === 0 && (
        <div className="px-4 pb-3 ml-7 border-t border-gray-100 dark:border-zinc-800 pt-2">
          <p className="text-xs text-gray-400 dark:text-zinc-600 italic">No steps defined.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleList
// ---------------------------------------------------------------------------

export function ScheduleList({
  schedules,
  projectId,
}: {
  schedules: ScheduleEntry[];
  projectId: string;
}) {
  const overdue = schedules.filter((s) => s.isOverdue);
  const onSchedule = schedules.filter((s) => !s.isOverdue);

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <section aria-label="Overdue schedules">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-red-600 dark:text-red-400 mb-2">
            Overdue ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((s) => (
              <ScheduleRow key={s.id} entry={s} projectId={projectId} />
            ))}
          </div>
        </section>
      )}

      {onSchedule.length > 0 && (
        <section aria-label="On-schedule tasks">
          {overdue.length > 0 && (
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-2">
              On schedule ({onSchedule.length})
            </h2>
          )}
          <div className="space-y-2">
            {onSchedule.map((s) => (
              <ScheduleRow key={s.id} entry={s} projectId={projectId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
