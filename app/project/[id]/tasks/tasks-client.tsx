"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import type { ProjectDetail, TaskItem } from "@/lib/redeye-types";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ActiveTaskCard } from "@/components/tasks/active-task-card";
import { BacklogSection } from "@/components/tasks/backlog-section";
import { DoneSection } from "@/components/tasks/done-section";
import { PageHeader } from "@/components/page-header";
import {
  TaskSection,
  WontDoItemRow,
} from "@/components/tasks/task-row";
import { parseTaskIdNumber } from "@/components/tasks/task-filter-utils";

// Re-exports preserved for `page.test.tsx`, which imports these directly from
// `./tasks-client`. Do not remove without updating the test file.
export { BacklogSection, TaskSection, WontDoItemRow, parseTaskIdNumber };

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

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

  // `detail` is read inside fetchDetail to decide whether a transient fetch
  // failure should surface a banner (only on first-load when there's nothing
  // to fall back to). Keep it in a ref so fetchDetail's identity is stable
  // across re-renders — listing `detail` in the useCallback deps caused the
  // 10s interval to be torn down + recreated after every successful poll
  // (mission-control-client uses the same ref pattern; tasks-client missed it).
  const detailRef = useRef<ProjectDetail | null>(null);
  useEffect(() => { detailRef.current = detail; }, [detail]);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } catch {
      if (!detailRef.current) {
        setFetchError("Failed to load tasks.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 10_000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  const activeItem = detail?.activeItem ?? null;
  const activeId = activeItem?.id ?? null;

  const allItems: TaskItem[] = [
    ...(detail?.upNext ?? []),
    // Use allDoneItems (full list) not recentlyShipped (limited to 8) so the
    // Done section shows the complete count and all done tasks are paginated.
    ...(detail?.allDoneItems ?? []),
    ...(detail?.wontDoItems ?? []),
  ];

  const { plannedItems, doneItems, wontDoItems } = computeBuckets(
    allItems,
    activeId,
  );

  const totalCount = allItems.length + (activeItem ? 1 : 0);

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Control Tower"
        title="Tasks"
        subtitle={`${totalCount} ${totalCount === 1 ? "item" : "items"}`}
        actions={
          <button
            onClick={() => setAddDialogOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
          >
            + Add Item
          </button>
        }
      />

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

          {plannedItems.length > 0 && (
            <CollapsibleSection
              label="Backlog"
              count={plannedItems.length}
              open={backlogSubsectionOpen}
              onToggle={() => setBacklogSubsectionOpen((o) => !o)}
            >
              <BacklogSection items={plannedItems} projectId={projectId} />
            </CollapsibleSection>
          )}

          {doneItems.length > 0 && (
            <CollapsibleSection
              label="Done"
              count={doneItems.length}
              open={doneOpen}
              onToggle={() => setDoneOpen((o) => !o)}
            >
              <DoneSection items={doneItems} projectId={projectId} />
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
