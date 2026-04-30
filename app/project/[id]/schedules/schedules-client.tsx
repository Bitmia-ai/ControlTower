"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import type { ScheduleEntry } from "@/lib/redeye-types";
import { ScheduleList } from "@/components/schedules/schedule-list";
import { AddScheduleDialog } from "@/components/schedules/add-schedule-dialog";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { ListToolbar } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { useListFilter } from "@/lib/use-list-filter";
import { PageHeader } from "@/components/page-header";

const SCHEDULES_PAGE_SIZE = 15;

function SchedulesSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 bg-gray-100 dark:bg-zinc-800/60 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search / filter helpers
// ---------------------------------------------------------------------------

function scheduleSearchFn(entry: ScheduleEntry, query: string): boolean {
  return (
    entry.id.toLowerCase().includes(query) ||
    entry.title.toLowerCase().includes(query) ||
    entry.frequency.toLowerCase().includes(query)
  );
}

const scheduleFilterFns: Record<
  string,
  (entry: ScheduleEntry, v: string) => boolean
> = {
  status: (entry, v) => {
    if (v === "overdue") return entry.isOverdue;
    if (v === "never-run") return entry.lastRunIso === null && !entry.isOverdue;
    if (v === "on-schedule")
      return !entry.isOverdue && entry.lastRunIso !== null;
    return true;
  },
};

const scheduleSortFns: Record<
  string,
  (a: ScheduleEntry, b: ScheduleEntry) => number
> = {
  "next-due": (a, b) => {
    if (a.nextDueMs === null && b.nextDueMs === null) return 0;
    if (a.nextDueMs === null) return 1;
    if (b.nextDueMs === null) return -1;
    return a.nextDueMs - b.nextDueMs;
  },
  "last-run": (a, b) => {
    const aMs = a.lastRunIso ? Date.parse(a.lastRunIso) : 0;
    const bMs = b.lastRunIso ? Date.parse(b.lastRunIso) : 0;
    return bMs - aMs;
  },
  title: (a, b) => a.title.localeCompare(b.title),
};

// ---------------------------------------------------------------------------
// FilteredScheduleList — renders the filtered+paginated schedule list
// ---------------------------------------------------------------------------

function FilteredScheduleList({
  schedules,
  projectId,
  onDelete,
}: {
  schedules: ScheduleEntry[];
  projectId: string;
  onDelete?: (id: string) => void;
}) {
  const {
    pagedItems,
    page,
    setPage,
    pageCount,
    totalCount,
    filteredCount,
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    activeSort,
    setSort,
    resetFilters,
  } = useListFilter({
    items: schedules,
    pageSize: SCHEDULES_PAGE_SIZE,
    defaultSort: "next-due",
    searchFn: scheduleSearchFn,
    sortFns: scheduleSortFns,
    filterFns: scheduleFilterFns,
  });

  const statusFilterConfig = useMemo(
    () => ({
      key: "status",
      label: "Status",
      options: [
        { value: "overdue", label: "Overdue" },
        { value: "on-schedule", label: "On schedule" },
        { value: "never-run", label: "Never run" },
      ],
      value: filters["status"] ?? null,
      onChange: (v: string | null) => setFilter("status", v),
    }),
    [filters, setFilter]
  );

  const sortOptions = useMemo(
    () => [
      { key: "next-due", label: "Next due" },
      { key: "last-run", label: "Last run" },
      { key: "title", label: "Title A–Z" },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search schedules…"
        filters={[statusFilterConfig]}
        sortOptions={sortOptions}
        activeSort={activeSort}
        onSortChange={setSort}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      {pagedItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
          No schedules match your filters.{" "}
          <button
            type="button"
            onClick={resetFilters}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ScheduleList schedules={pagedItems} projectId={projectId} onDelete={onDelete} />
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={SCHEDULES_PAGE_SIZE}
        totalCount={filteredCount}
      />
    </div>
  );
}

/**
 * Inner content component — exported for testing without the use(params) wrapper.
 */
export function SchedulesContent({ id }: { id: string }) {
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleDelete = useCallback((deletedId: string) => {
    setSchedules((prev) =>
      prev ? prev.filter((s) => s.id !== deletedId) : prev
    );
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/schedules`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Request failed" }));
        setError(json.error ?? "Request failed");
        return;
      }
      const json = await res.json();
      setSchedules(json.data?.schedules ?? []);
      setError(null);
    } catch {
      setError("Failed to load schedules");
    }
  }, [id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const count = schedules?.length ?? 0;

  return (
    <div className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Control Tower"
        title="Schedules"
        subtitle={
          schedules === null
            ? "Loading scheduled tasks…"
            : `${count} scheduled ${count === 1 ? "task" : "tasks"}`
        }
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
          >
            + Add Schedule
          </button>
        }
      />

      {error ? (
        <FetchError
          message={`Failed to load schedules: ${error}`}
          onRetry={fetchSchedules}
        />
      ) : schedules === null ? (
        <SchedulesSkeleton />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No schedules defined"
          subtitle="Add a recurring task to get started."
          action={{ label: "+ Add Schedule", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <FilteredScheduleList schedules={schedules} projectId={id} onDelete={handleDelete} />
      )}

      <AddScheduleDialog
        projectId={id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={fetchSchedules}
      />
    </div>
  );
}

export default function SchedulesPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SchedulesContent id={id} />;
}
