"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { ProjectDetail, TaskItem } from "@/lib/redeye-types";
import { TaskId } from "@/components/task-id";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { CollapsibleSection } from "@/components/collapsible-section";
import { SectionHeader } from "@/components/section-header";

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


/**
 * Parse the numeric portion of a T-prefixed id. Used for sorting items newest-first.
 * Falls back to 0 if the id is malformed.
 */
export function parseTaskIdNumber(id: string): number {
  const match = id.match(/T(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) || 0;
}

/**
 * Compute the three buckets (planned / done / wontdo) from a flat list of all tasks.
 * Exported so tests can verify the filtering + sort logic without rendering the page.
 */
export function computeBuckets(
  allItems: TaskItem[],
  activeId: string | null,
): {
  plannedItems: TaskItem[];
  doneItems: TaskItem[];
  wontDoItems: TaskItem[];
} {
  const plannedItems = allItems.filter(
    (i) => i.status !== "done" && i.status !== "wontdo" && i.id !== activeId,
  );
  const doneItems = allItems
    .filter((i) => i.status === "done" && i.id !== activeId)
    .sort((a, b) => parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id));
  const wontDoItems = allItems.filter((i) => i.status === "wontdo");
  return { plannedItems, doneItems, wontDoItems };
}

function ActiveTaskCard({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div>
      <SectionHeader label="Currently Working On" className="mb-3" />
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 border-l-2 border-l-green-500">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse block" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-zinc-100 leading-snug font-medium">
              <TaskId
                id={item.id}
                projectId={projectId}
                className="text-xs text-gray-400 dark:text-zinc-500 mr-1.5 font-normal"
              />
              <Link
                href={`/project/${projectId}/tasks/${item.id}`}
                className="hover:text-red-600 dark:hover:text-red-400 transition"
              >
                {item.title}
              </Link>
            </p>
            {item.type && (
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5 font-normal">{item.type}</p>
            )}
          </div>
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
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 font-medium">
              in-progress
            </span>
            <Link
              href={`/project/${projectId}/live`}
              className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition"
            >
              View Live
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskSection({
  label,
  items,
  projectId,
}: {
  label?: string;
  items: TaskItem[];
  projectId: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {label && <SectionHeader label={label} count={items.length} className="mb-3" />}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-transparent rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-zinc-100 leading-snug">
                <TaskId
                  id={item.id}
                  projectId={projectId}
                  className="text-xs text-gray-400 dark:text-zinc-500 mr-1.5"
                />
                <Link
                  href={`/project/${projectId}/tasks/${item.id}`}
                  className="hover:text-red-600 dark:hover:text-red-400 transition"
                >
                  {item.title}
                </Link>
              </p>
              {item.type && (
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">{item.type}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {item.status === "done" && item.cost_usd !== undefined && item.cost_usd > 0 && (
                <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
                  ${item.cost_usd.toFixed(2)}
                </span>
              )}
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
        ))}
      </div>
    </div>
  );
}

function DoneItemRow({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
      <Check
        className="w-3.5 h-3.5 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <TaskId
            id={item.id}
            projectId={projectId}
            className="text-xs text-gray-400 dark:text-zinc-600 mr-1.5"
          />
          <Link
            href={`/project/${projectId}/tasks/${item.id}`}
            className="text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            {item.title}
          </Link>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.cost_usd !== undefined && item.cost_usd > 0 && (
          <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">
            ${item.cost_usd.toFixed(2)}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
          done
        </span>
      </div>
    </div>
  );
}

export function WontDoItemRow({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
      <X
        className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <TaskId
            id={item.id}
            projectId={projectId}
            className="text-xs text-gray-400 dark:text-zinc-600 mr-1.5"
          />
          <Link
            href={`/project/${projectId}/tasks/${item.id}`}
            className="text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition line-through decoration-gray-300 dark:decoration-zinc-600"
          >
            {item.title}
          </Link>
        </p>
        {item.reason && (
          <p
            data-testid="wontdo-reason"
            className="text-xs text-gray-500 dark:text-zinc-500 mt-1 leading-snug"
          >
            <span className="font-mono uppercase tracking-[0.14em] text-[10px] text-gray-400 dark:text-zinc-600 mr-1.5">
              Reason
            </span>
            {item.reason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500">
          won&apos;t do
        </span>
      </div>
    </div>
  );
}

export default function TasksPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [backlogSubsectionOpen, setBacklogSubsectionOpen] = useState(true);
  const [doneOpen, setDoneOpen] = useState(false);
  const [wontDoOpen, setWontDoOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } catch {
      if (!detail) {
        setFetchError("Failed to load tasks.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, detail]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 10_000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  const activeItem = detail?.activeItem ?? null;
  const activeId = activeItem?.id ?? null;

  const allItems: TaskItem[] = [
    ...(detail?.upNext ?? []),
    ...(detail?.recentlyShipped ?? []),
    ...(detail?.wontDoItems ?? []),
  ];

  const { plannedItems, doneItems, wontDoItems } = computeBuckets(
    allItems,
    activeId,
  );

  const sortedBacklog = [...plannedItems].sort((a, b) => {
    const pri = (p: string | undefined) =>
      p === "P0" ? 0 : p === "P1" ? 1 : p === "P2" ? 2 : 3;
    const dp = pri(a.priority) - pri(b.priority);
    if (dp !== 0) return dp;
    return parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id);
  });

  const totalCount = allItems.length + (activeItem ? 1 : 0);

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
              Tasks
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              {totalCount} {totalCount === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
          >
            + Add Item
          </button>
        </div>
      </header>

      {loading && !detail ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading tasks…
        </div>
      ) : fetchError && !detail ? (
        <FetchError message={fetchError} onRetry={fetchDetail} />
      ) : allItems.length === 0 ? (
        <EmptyState
          icon={<span>~</span>}
          title="No tasks yet"
          subtitle="Add items to track work for this project."
          action={{ label: "+ Add Item", onClick: () => setAddDialogOpen(true) }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {activeItem && (
            <ActiveTaskCard item={activeItem} projectId={projectId} />
          )}

          {sortedBacklog.length > 0 && (
            <CollapsibleSection
              label="Backlog"
              count={sortedBacklog.length}
              open={backlogSubsectionOpen}
              onToggle={() => setBacklogSubsectionOpen((o) => !o)}
            >
              <TaskSection items={sortedBacklog} projectId={projectId} />
            </CollapsibleSection>
          )}

          {doneItems.length > 0 && (
            <CollapsibleSection
              label="Done"
              count={doneItems.length}
              open={doneOpen}
              onToggle={() => setDoneOpen((o) => !o)}
            >
              <div className="flex flex-col gap-0.5 pb-1">
                {doneItems.map((item) => (
                  <DoneItemRow
                    key={item.id}
                    item={item}
                    projectId={projectId}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {wontDoItems.length > 0 && (
            <CollapsibleSection
              label="Won't Do"
              count={wontDoItems.length}
              open={wontDoOpen}
              onToggle={() => setWontDoOpen((o) => !o)}
            >
              <div className="flex flex-col gap-0.5 pb-1">
                {wontDoItems.map((item) => (
                  <WontDoItemRow
                    key={item.id}
                    item={item}
                    projectId={projectId}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      )}

      <AddTaskDialog
        projectId={projectId}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdded={fetchDetail}
      />
    </main>
  );
}
