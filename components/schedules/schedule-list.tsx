"use client";

import { useEffect, useState } from "react";
import type { ScheduleEntry } from "@/lib/redeye-types";
import { formatRelativeMs } from "@/lib/format-relative-time";
import * as logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// localStorage helpers for "Queued" indicator persistence (T126)
//
// The "Queued (T<N>) ✓" success label set by RunButton is in-memory React state
// and is lost on a page refresh. We persist a tiny entry in localStorage so the
// label is restored on mount until the underlying task is no longer pending.
//
// SSR safety: every access is guarded by `typeof window !== "undefined"`. Quota
// errors are swallowed — the indicator is best-effort UX, not durable data.
// ---------------------------------------------------------------------------

const QUEUED_TTL_MS = 5 * 60 * 1000; // 5-minute absolute fallback expiry

function storageKey(projectId: string, scheduleId: string): string {
  return `ct_run_queued__${projectId}__${scheduleId}`;
}

type QueuedEntry = { taskId: string; queuedAt: number };

function readQueued(key: string): QueuedEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QueuedEntry>;
    if (
      parsed &&
      typeof parsed.taskId === "string" &&
      typeof parsed.queuedAt === "number"
    ) {
      return { taskId: parsed.taskId, queuedAt: parsed.queuedAt };
    }
    return null;
  } catch {
    return null;
  }
}

function writeQueued(key: string, taskId: string): void {
  if (typeof window === "undefined") return;
  try {
    const value: QueuedEntry = { taskId, queuedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or serialization error — ignore; in-memory state still works.
  }
}

function clearQueued(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
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
// DeleteButton + inline confirmation
// ---------------------------------------------------------------------------

type DeleteState = "idle" | "confirming" | "loading" | "error";

function DeleteButton({
  scheduleId,
  projectId,
  onDeleted,
}: {
  scheduleId: string;
  projectId: string;
  onDeleted: (id: string) => void;
}) {
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleteState("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/schedules/${scheduleId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json.error ?? "Delete failed");
        setDeleteState("error");
        return;
      }
      onDeleted(scheduleId);
    } catch {
      setErrorMsg("Delete failed");
      setDeleteState("error");
    }
  }

  if (
    deleteState === "confirming" ||
    deleteState === "loading" ||
    deleteState === "error"
  ) {
    return (
      <div className="flex flex-col gap-1 items-end">
        {deleteState === "error" && errorMsg && (
          <span className="text-xs text-red-500 dark:text-red-400">
            {errorMsg}
          </span>
        )}
        <p className="text-xs text-gray-600 dark:text-zinc-400">
          Delete this schedule?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`Confirm delete schedule ${scheduleId}`}
            disabled={deleteState === "loading"}
            onClick={handleConfirm}
            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleteState === "loading" ? "Deleting…" : "Confirm"}
          </button>
          <button
            type="button"
            aria-label="Cancel delete"
            onClick={() => {
              setDeleteState("idle");
              setErrorMsg(null);
            }}
            className="text-xs font-medium text-gray-500 dark:text-zinc-400 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Delete schedule ${scheduleId}`}
      onClick={(e) => {
        e.stopPropagation();
        setDeleteState("confirming");
      }}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
    >
      {/* Trash icon */}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path
          d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5L13 4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
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
  const [taskId, setTaskId] = useState<string | null>(null);

  // T126: restore the "Queued (T<N>) ✓" indicator across page refresh by
  // reading a per-(project, schedule) entry from localStorage on mount. The
  // entry is cleared if the task is no longer pending or older than 5 minutes.
  useEffect(() => {
    const key = storageKey(projectId, scheduleId);
    const entry = readQueued(key);
    if (!entry) return;

    if (Date.now() - entry.queuedAt >= QUEUED_TTL_MS) {
      clearQueued(key);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/tasks/${entry.taskId}`,
          { method: "GET" }
        );
        if (cancelled) return;
        if (!res.ok) {
          clearQueued(key);
          return;
        }
        const json = await res.json().catch(() => null);
        const status: unknown = json?.data?.status;
        if (status === "pending") {
          setTaskId(entry.taskId);
          setRunState("success");
        } else {
          clearQueued(key);
        }
      } catch {
        if (!cancelled) clearQueued(key);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-once: projectId / scheduleId are stable for the row's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRun(e: React.MouseEvent) {
    e.stopPropagation();
    if (runState === "loading") return;
    const key = storageKey(projectId, scheduleId);
    setRunState("loading");
    setTaskId(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedules/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        logger.error("schedules/run", "Run schedule failed:", json.error);
        setRunState("error");
      } else {
        const json = await res.json().catch(() => ({}));
        const newTaskId =
          typeof json?.data?.taskId === "string" ? json.data.taskId : null;
        if (newTaskId) {
          writeQueued(key, newTaskId);
        }
        setTaskId(newTaskId);
        setRunState("success");
      }
    } catch {
      setRunState("error");
    }

    // Reset back to idle after 3 seconds. Also clear the localStorage entry —
    // the in-memory label is gone, no point keeping the persisted hint that
    // would re-restore on the next render.
    setTimeout(() => {
      setRunState("idle");
      setTaskId(null);
      clearQueued(key);
    }, 3000);
  }

  const successLabel = taskId ? `Queued (${taskId}) ✓` : "Queued ✓";
  const label =
    runState === "loading"
      ? "Queuing…"
      : runState === "success"
        ? successLabel
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
  onDelete,
}: {
  entry: ScheduleEntry;
  projectId: string;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const nowMs = Date.now();

  const lastRunLabel = entry.lastRunIso
    ? formatRelativeMs(Date.parse(entry.lastRunIso), nowMs)
    : "Never";

  // When the schedule has never run, nextDueMs is 0 (not null) because the
  // parser marks it overdue. Show "—" instead of "56 years ago".
  const nextDueLabel = entry.lastRunIso === null
    ? "—"
    : entry.nextDueMs !== null
      ? formatRelativeMs(entry.nextDueMs, nowMs)
      : "—";

  // Top status border: amber for overdue, zinc for never-run, green for on-schedule.
  const topBorder = entry.isOverdue
    ? "border-t-amber-400"
    : entry.lastRunIso === null
    ? "border-t-zinc-300 dark:border-t-zinc-700"
    : "border-t-green-500";

  return (
    <div
      className={`group rounded-lg border border-t-[3px] ${topBorder} transition-colors ${
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

        {/* Status badge + roles + run button + delete button — siblings of the expand button */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <StatusBadge entry={entry} />
          {entry.assignedTo && (
            <span className="text-xs text-gray-400 dark:text-zinc-600">
              {entry.assignedTo}
            </span>
          )}
          <RunButton scheduleId={entry.id} projectId={projectId} />
          {onDelete && (
            <DeleteButton
              scheduleId={entry.id}
              projectId={projectId}
              onDeleted={onDelete}
            />
          )}
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
  onDelete,
}: {
  schedules: ScheduleEntry[];
  projectId: string;
  onDelete?: (id: string) => void;
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
              <ScheduleRow
                key={s.id}
                entry={s}
                projectId={projectId}
                onDelete={onDelete}
              />
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
              <ScheduleRow
                key={s.id}
                entry={s}
                projectId={projectId}
                onDelete={onDelete}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
