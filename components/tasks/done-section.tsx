import { useMemo } from "react";
import type { TaskItem } from "@/lib/redeye-types";
import { ListToolbar } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { useListFilter } from "@/lib/use-list-filter";
import {
  DONE_PAGE_SIZE,
  taskSearchFn,
  parseTaskIdNumber,
} from "./task-filter-utils";
import { DoneItemRow } from "./task-row";

const doneSortFns: Record<string, (a: TaskItem, b: TaskItem) => number> = {
  newest: (a, b) => parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id),
  oldest: (a, b) => parseTaskIdNumber(a.id) - parseTaskIdNumber(b.id),
  title: (a, b) => a.title.localeCompare(b.title),
};

export function DoneSection({
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
    activeSort,
    setSort,
    resetFilters,
  } = useListFilter({
    items,
    pageSize: DONE_PAGE_SIZE,
    defaultSort: "newest",
    searchFn: taskSearchFn,
    sortFns: doneSortFns,
  });

  const sortOptions = useMemo(
    () => [
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
        searchPlaceholder="Search done items…"
        sortOptions={sortOptions}
        activeSort={activeSort}
        onSortChange={setSort}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      {pagedItems.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
          No items match.{" "}
          <button
            type="button"
            onClick={resetFilters}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 pb-1">
          {pagedItems.map((item) => (
            <DoneItemRow key={item.id} item={item} projectId={projectId} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={DONE_PAGE_SIZE}
        totalCount={filteredCount}
      />
    </div>
  );
}
