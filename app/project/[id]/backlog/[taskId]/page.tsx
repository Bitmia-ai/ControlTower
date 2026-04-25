"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BacklogItem } from "@/lib/redeye-types";
import { BacklogId } from "@/components/backlog-id";
import { FetchError } from "@/components/fetch-error";
import { BacklogSummarySection } from "@/components/backlog-summary-section";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  "pending-triage": "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  wontdo: "bg-gray-200 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500 line-through",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-600 text-white dark:bg-red-700",
  P1: "bg-orange-500 text-white dark:bg-orange-700",
  P2: "bg-gray-200 text-gray-700 dark:bg-zinc-600 dark:text-zinc-200",
};

const PRIORITY_OPTIONS = ["P0", "P1", "P2"];
const STATUS_OPTIONS = [
  "pending",
  "planned",
  "in-progress",
  "done",
  "blocked",
  "pending-triage",
  "wontdo",
];

export default function BacklogItemPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = use(params);
  const router = useRouter();

  const [item, setItem] = useState<BacklogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cost snapshot state
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}/backlog/${taskId}`);
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
      if (!item) {
        setFetchError("Failed to load backlog item.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, taskId, item]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  function openEdit() {
    if (!item) return;
    setEditTitle(item.title);
    setEditPriority(item.priority ?? "");
    setEditDescription(item.details ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/backlog/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || item.title,
          priority: editPriority || item.priority,
          details: editDescription,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("Failed to save backlog item:", json.error);
        return;
      }
      if (json.data) {
        setItem(json.data);
      }
      setEditing(false);
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
        body: JSON.stringify({ blId: taskId }),
      });
      if (!res.ok) {
        console.error("Failed to record cost snapshot:", res.status);
        setSnapshotMessage("Failed to record — try again.");
        return;
      }
      const json = await res.json();
      if (json.data?.recorded === false) {
        setSnapshotMessage("No active transcript — cost not captured.");
        return;
      }
      await fetchItem();
    } catch (err) {
      console.error("Failed to record cost snapshot:", err);
      setSnapshotMessage("Failed to record — try again.");
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}/backlog/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(`/project/${id}/backlog`);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      <Link
        href={`/project/${id}/backlog`}
        className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition inline-flex items-center gap-1 mb-3"
      >
        <span>&larr;</span>
        <span>Backlog</span>
      </Link>

      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower &mdash; Backlog
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
          <p className="text-gray-500 dark:text-zinc-600 text-sm">Backlog item not found.</p>
          <Link
            href={`/project/${id}/backlog`}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
          >
            Return to Backlog
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

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
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
                <dd><BacklogId id={item.id} projectId={id} /></dd>
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
                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-0.5">Status</dt>
                <dd className="text-gray-800 dark:text-zinc-200">{item.status}</dd>
              </div>
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

            {item.summary && (
              <BacklogSummarySection
                summary={item.summary}
                defaultOpen={item.status === "done"}
              />
            )}

            {item.details && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
                  Details
                </h3>
                <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none text-gray-700 dark:text-zinc-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {item.details}
                  </ReactMarkdown>
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
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-zinc-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-md transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200 rounded-md transition"
                >
                  Cancel
                </button>
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
