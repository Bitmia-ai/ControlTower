import { useMemo } from "react";
import Link from "next/link";
import type { TaskItem } from "@/lib/redeye-types";
import { TaskId } from "@/components/task-id";
import { ListToolbar } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { useListFilter } from "@/lib/use-list-filter";
import {
  STATUS_COLORS,
  PRIORITY_COLORS,
  AUTHOR_BADGE_STYLES,
  taskAuthor,
} from "@/lib/task-badge-styles";
import {
  BACKLOG_PAGE_SIZE,
  taskSearchFn,
  taskFilterFns,
  parseTaskIdNumber,
} from "./task-filter-utils";

const backlogSortFns: Record<string, (a: TaskItem, b: TaskItem) => number> = {
  priority: (a, b) => {
    const pri = (p: string | undefined) =>
      p === "P0" ? 0 : p === "P1" ? 1 : p === "P2" ? 2 : 3;
    const dp = pri(a.priority) - pri(b.priority);
    if (dp !== 0) return dp;
    return parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id);
  },
  newest: (a, b) => parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id),
  oldest: (a, b) => parseTaskIdNumber(a.id) - parseTaskIdNumber(b.id),
  title: (a, b) => a.title.localeCompare(b.title),
};

export function BacklogSection({
  items,
  projectId,
}: {
  items: TaskItem[];
  projectId: number;
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
    items,
    pageSize: BACKLOG_PAGE_SIZE,
    defaultSort: "priority",
    searchFn: taskSearchFn,
    sortFns: backlogSortFns,
    filterFns: taskFilterFns,
  });

  const priorityFilterConfig = useMemo(
    () => ({
      key: "priority",
      label: "Priority",
      options: [
        { value: "P0", label: "P0" },
        { value: "P1", label: "P1" },
        { value: "P2", label: "P2" },
      ],
      value: filters["priority"] ?? null,
      onChange: (v: string | null) => setFilter("priority", v),
    }),
    [filters, setFilter]
  );

  const statusFilterConfig = useMemo(
    () => ({
      key: "status",
      label: "Status",
      options: [
        { value: "pending", label: "Pending" },
        { value: "planned", label: "Planned" },
        { value: "in-progress", label: "In Progress" },
        { value: "blocked", label: "Blocked" },
      ],
      value: filters["status"] ?? null,
      onChange: (v: string | null) => setFilter("status", v),
    }),
    [filters, setFilter]
  );

  const authorFilterConfig = useMemo(
    () => ({
      key: "author",
      label: "Created by",
      options: [
        { value: "user", label: "Created by User" },
        { value: "redeye", label: "Created by RedEye" },
      ],
      value: filters["author"] ?? null,
      onChange: (v: string | null) => setFilter("author", v),
    }),
    [filters, setFilter]
  );

  const sortOptions = useMemo(
    () => [
      { key: "priority", label: "Priority" },
      { key: "newest", label: "Newest first" },
      { key: "oldest", label: "Oldest first" },
      { key: "title", label: "Title A–Z" },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search backlog…"
        filters={[priorityFilterConfig, statusFilterConfig, authorFilterConfig]}
        sortOptions={sortOptions}
        activeSort={activeSort}
        onSortChange={setSort}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      {pagedItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-zinc-500">
          No items match your filters.{" "}
          <button
            type="button"
            onClick={resetFilters}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pagedItems.map((item) => {
            const authorStyle = AUTHOR_BADGE_STYLES[taskAuthor(item.section)];
            return (
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
                    className={`text-xs px-2 py-0.5 rounded font-medium ${authorStyle.className}`}
                  >
                    {authorStyle.label}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={BACKLOG_PAGE_SIZE}
        totalCount={filteredCount}
      />
    </div>
  );
}
