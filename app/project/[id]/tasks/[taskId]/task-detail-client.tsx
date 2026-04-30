"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { TaskItem } from "@/lib/redeye-types";
import type { TaskDurationResult } from "@/lib/task-duration";

// Dynamic import moves react-markdown out of the shared chunk into a lazy
// route chunk that is only fetched when the task detail page is visited.
const MarkdownRenderer = dynamic(
  () => import("@/components/markdown-renderer"),
  {
    ssr: false,
    loading: () => (
      <span className="text-gray-400 dark:text-zinc-600 animate-pulse">…</span>
    ),
  }
);
import { TaskId } from "@/components/task-id";
import { FetchError } from "@/components/fetch-error";
import { TaskSummarySection } from "@/components/task-summary-section";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  AUTHOR_BADGE_STYLES,
  taskAuthor,
} from "@/lib/task-badge-styles";

export default function TaskDetailClient({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = use(params);
  const router = useRouter();

  const [item, setItem] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Cost snapshot state
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);

  // Duration state (T119): fetched once after task loads when status=done.
  // Decoupled from the task fetch so the main view never blocks on the
  // dedicated duration endpoint, and the row degrades gracefully when the
  // iteration_log window does not cover the task.
  const [duration, setDuration] = useState<TaskDurationResult | null>(null);
  const [durationLoading, setDurationLoading] = useState(false);

  // `item` is read inside fetchItem to decide whether a transient error
  // should surface. Mirror via a ref so fetchItem's identity stays stable —
  // listing `item` in the deps recreates fetchItem on every successful load,
  // which then re-fires the useEffect and causes a self-perpetuating fetch
  // loop. (Same pattern as tasks-client.tsx / mission-control-client.tsx.)
  const itemRef = useRef<TaskItem | null>(null);
  useEffect(() => { itemRef.current = item; }, [item]);

  const fetchItem = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}/tasks/${taskId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setItem(json.data);
      }
    } catch {
      if (!itemRef.current) {
        setFetchError("Failed to load task.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, taskId]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Duration fetch — only runs when the loaded item is done. Failures are
  // silently swallowed so the rest of the detail view stays usable.
  useEffect(() => {
    if (!item || item.status !== "done") return;
    let cancelled = false;
    setDurationLoading(true);
    fetch(`/api/projects/${id}/tasks/${taskId}/duration`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.data) setDuration(json.data as TaskDurationResult);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDurationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, taskId, item]);

  function openEdit() {
    if (!item) return;
    setEditTitle(item.title);
    setEditPriority(item.priority ?? "");
    // Prefer description (the primary multi-line field) over details (legacy
    // bullet-list sub-field). CEO-created tasks only have description; older
    // RedEye-generated tasks may only have details. See T122.
    setEditDescription(item.description ?? item.details ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || item.title,
          priority: editPriority || item.priority,
          description: editDescription,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Save failed — surface the error and keep the user in edit mode so
        // the form value is not lost. Without this, the spinner just stops
        // and the user has no idea the save didn't happen (the bug from the
        // 2026-04-29 review).
        setSaveError(
          (json && typeof json.error === "string" && json.error) ||
            `Save failed (HTTP ${res.status}). Try again or copy your changes elsewhere before navigating away.`
        );
        return;
      }
      if (json.data) {
        setItem(json.data);
      }
      setEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? `Save failed: ${err.message}`
          : "Save failed: network error. Try again or copy your changes elsewhere before navigating away."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordCost() {
    if (!item) return;
    setSnapshotting(true);
    setSnapshotMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/cost-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) {
        setSnapshotMessage("Failed to record — try again.");
        return;
      }
      const json = await res.json();
      if (json.data?.recorded === false) {
        setSnapshotMessage("No active transcript — cost not captured.");
        return;
      }
      await fetchItem();
    } catch {
      setSnapshotMessage("Failed to record — try again.");
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Mirror the save-error pattern: surface failure inline so the user
        // isn't left wondering whether the click registered. Parse the JSON
        // body opportunistically — DELETE handlers may return an error
        // string, but a plain HTTP-status fallback is fine when they don't.
        let serverError: string | null = null;
        try {
          const json = await res.json();
          if (json && typeof json.error === "string") serverError = json.error;
        } catch {
          // ignore — fall through to the HTTP-status message
        }
        setDeleteError(
          serverError ||
            `Delete failed (HTTP ${res.status}). Try again.`
        );
        return;
      }
      router.push(`/project/${id}/tasks`);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? `Delete failed: ${err.message}`
          : "Delete failed: network error. Try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto overflow-x-hidden">
      <Link
        href={`/project/${id}/tasks`}
        className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition inline-flex items-center gap-1 mb-3"
      >
        <span>&larr;</span>
        <span>Tasks</span>
      </Link>

      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower &mdash; Tasks
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
              {loading ? "Loading…" : item?.title ?? taskId}
            </h1>
            <p className="font-mono text-[11px] text-gray-500 dark:text-zinc-500 mt-1">
              {taskId}
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading…
        </div>
      ) : fetchError && !item ? (
        <FetchError message={fetchError} onRetry={fetchItem} />
      ) : notFound || !item ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-gray-500 dark:text-zinc-600 text-sm">Task not found.</p>
          <Link
            href={`/project/${id}/tasks`}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
          >
            Return to Tasks
          </Link>
        </div>
      ) : editing ? (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6 flex flex-col gap-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
            Edit Item
          </h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-500 dark:text-zinc-500">Title</label>
            <input
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-red-600"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-500 dark:text-zinc-500">Priority</label>
            <select
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-red-600"
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
            >
              <option value="">— none —</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-500 dark:text-zinc-500">
              Description (notes)
            </label>
            <textarea
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-red-600 min-h-[100px] resize-y"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          {saveError && (
            <p
              role="alert"
              className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md px-3 py-2"
            >
              {saveError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSaveError(null);
              }}
              className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 rounded-md transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <h2 className="min-w-0 flex-1 text-lg font-semibold text-gray-900 dark:text-zinc-100 leading-snug">
                {item.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {item.priority && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      PRIORITY_COLORS[item.priority] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.priority}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">ID</dt>
                <dd><TaskId id={item.id} projectId={id} /></dd>
              </div>
              {item.type && (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Type</dt>
                  <dd className="text-gray-800 dark:text-zinc-200 capitalize">{item.type}</dd>
                </div>
              )}
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Section</dt>
                <dd className="text-gray-800 dark:text-zinc-200 capitalize">{item.section}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Created by</dt>
                <dd>
                  {(() => {
                    const author = AUTHOR_BADGE_STYLES[taskAuthor(item.section)];
                    return (
                      <span
                        data-testid="task-detail-author-badge"
                        className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${author.className}`}
                      >
                        {author.label}
                      </span>
                    );
                  })()}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Status</dt>
                <dd className="text-gray-800 dark:text-zinc-200">{item.status}</dd>
              </div>
              {item.status === "done" && duration?.durationMs != null && (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Duration</dt>
                  <dd className="text-gray-800 dark:text-zinc-200 font-mono">
                    {duration.formattedDuration}
                  </dd>
                </div>
              )}
              {item.status === "done" && durationLoading && !duration && (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Duration</dt>
                  <dd>
                    <span className="inline-block w-16 h-3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                  </dd>
                </div>
              )}
              {item.status === "done" && duration?.hourlyRate && (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Rate</dt>
                  <dd className="text-gray-800 dark:text-zinc-200 font-mono">
                    {duration.hourlyRate}
                  </dd>
                </div>
              )}
              {item.status === "done" && (
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Cost (est.)</dt>
                  <dd className="text-gray-800 dark:text-zinc-200 font-mono">
                    {item.cost_usd !== undefined && item.cost_usd > 0 ? (
                      `$${item.cost_usd.toFixed(2)}`
                    ) : (
                      <span className="inline-flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="text-gray-400 dark:text-zinc-600 font-sans">Not recorded</span>
                          <button
                            onClick={handleRecordCost}
                            disabled={snapshotting}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-sans disabled:opacity-50"
                          >
                            {snapshotting ? "Recording…" : "Record now"}
                          </button>
                        </span>
                        {snapshotMessage && (
                          <span className="text-xs text-gray-400 dark:text-zinc-500 font-sans">{snapshotMessage}</span>
                        )}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {item.status === "done" && duration && Array.isArray(duration.phaseBreakdown) && duration.phaseBreakdown.length >= 2 && (
              <details className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
                <summary className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 cursor-pointer">
                  Phase Breakdown
                </summary>
                <table className="mt-2 text-sm w-full text-left">
                  <thead>
                    <tr className="text-gray-500 dark:text-zinc-500 text-xs font-mono uppercase tracking-wide">
                      <th className="py-1 pr-4">Phase</th>
                      <th className="py-1">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duration.phaseBreakdown.map((span) => (
                      <tr
                        key={span.phase}
                        className="border-t border-gray-100 dark:border-zinc-800"
                      >
                        <td className="py-1 pr-4 text-gray-700 dark:text-zinc-300">
                          {span.phase}
                        </td>
                        <td className="py-1 text-gray-800 dark:text-zinc-200 font-mono">
                          {span.formattedDuration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {duration.planStartIso && duration.mergeEndIso && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
                    PLAN started approx. {new Date(duration.planStartIso).toLocaleString()} —
                    MERGE completed {new Date(duration.mergeEndIso).toLocaleString()}
                  </p>
                )}
              </details>
            )}

            {item.summary && (
              <TaskSummarySection
                summary={item.summary}
                defaultOpen={item.status === "done"}
              />
            )}

            {item.description && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
                  Description
                </h3>
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-gray-700 dark:text-zinc-300 overflow-x-auto">
                  <MarkdownRenderer>{item.description}</MarkdownRenderer>
                </div>
              </div>
            )}

            {item.details && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
                  Details
                </h3>
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-gray-700 dark:text-zinc-300 overflow-x-auto">
                  <MarkdownRenderer>{item.details}</MarkdownRenderer>
                </div>
              </div>
            )}

            {item.spec && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
                  Spec File
                </h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 font-mono">{item.spec}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={openEdit}
              className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 rounded-md transition"
            >
              Edit
            </button>
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-zinc-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-md transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 rounded-md transition"
                >
                  Cancel
                </button>
                {deleteError && (
                  <p
                    role="alert"
                    className="basis-full text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md px-3 py-2"
                  >
                    {deleteError}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900 text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-300 border border-gray-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-800 rounded-md transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
