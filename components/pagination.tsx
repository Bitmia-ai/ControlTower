"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;        // 1-indexed current page
  pageCount: number;
  onPageChange: (p: number) => void;
  pageSize: number;
  totalCount: number;
  className?: string;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  pageSize,
  totalCount,
  className = "",
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div
      className={`flex items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-zinc-800 ${className}`}
    >
      {/* Range info */}
      <p className="text-xs text-gray-500 dark:text-zinc-500 tabular-nums">
        {startItem}–{endItem} of {totalCount}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="p-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="text-xs text-gray-700 dark:text-zinc-300 tabular-nums min-w-[4rem] text-center">
          Page {page} of {pageCount}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="p-1.5 rounded-md text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
