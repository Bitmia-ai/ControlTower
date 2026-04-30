import { useState, useMemo, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseListFilterOptions<T> {
  items: T[];
  pageSize: number;
  defaultSort?: string;
  /** Return true if item matches the search query (query is already lowercased) */
  searchFn?: (item: T, query: string) => boolean;
  /** Sort comparator functions keyed by sort key */
  sortFns?: Record<string, (a: T, b: T) => number>;
  /**
   * Filter predicate functions keyed by filter key.
   * Each function receives (item, filterValue) and returns true to keep the item.
   */
  filterFns?: Record<string, (item: T, value: string) => boolean>;
}

export interface UseListFilterReturn<T> {
  /** Current page number (1-indexed) */
  page: number;
  setPage: (p: number) => void;
  /** Total number of pages after filtering */
  pageCount: number;
  /** Total items before filtering */
  totalCount: number;
  /** Items after filtering but before pagination */
  filteredCount: number;
  /** Items on the current page after filtering and sorting */
  pagedItems: T[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeSort: string;
  setSort: (key: string) => void;
  /** Active filter values keyed by filter key */
  filters: Record<string, string | null>;
  setFilter: (key: string, value: string | null) => void;
  resetFilters: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useListFilter<T>({
  items,
  pageSize,
  defaultSort = "",
  searchFn,
  sortFns,
  filterFns,
}: UseListFilterOptions<T>): UseListFilterReturn<T> {
  const [page, setPageRaw] = useState(1);
  const [searchQuery, setSearchQueryRaw] = useState("");
  const [activeSort, setActiveSort] = useState(defaultSort);
  const [filters, setFilters] = useState<Record<string, string | null>>({});

  // Reset to page 1 whenever search/filters change
  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryRaw(q);
    setPageRaw(1);
  }, []);

  const setFilter = useCallback((key: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageRaw(1);
  }, []);

  const setSort = useCallback((key: string) => {
    setActiveSort(key);
    setPageRaw(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQueryRaw("");
    setFilters({});
    setPageRaw(1);
  }, []);

  const setPage = useCallback((p: number) => {
    setPageRaw(p);
  }, []);

  // Filter + search
  const filteredItems = useMemo(() => {
    let result = items;

    // Text search
    if (searchQuery.trim() && searchFn) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((item) => searchFn(item, query));
    }

    // Active filters
    if (filterFns) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== null && filterFns[key]) {
          result = result.filter((item) => filterFns[key](item, value));
        }
      }
    }

    return result;
  }, [items, searchQuery, filters, searchFn, filterFns]);

  // Sort
  const sortedItems = useMemo(() => {
    if (!activeSort || !sortFns || !sortFns[activeSort]) {
      return filteredItems;
    }
    return [...filteredItems].sort(sortFns[activeSort]);
  }, [filteredItems, activeSort, sortFns]);

  // Paginate
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), pageCount);

  const pagedItems = useMemo(() => {
    const start = (clampedPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, clampedPage, pageSize]);

  return {
    page: clampedPage,
    setPage,
    pageCount,
    totalCount: items.length,
    filteredCount: sortedItems.length,
    pagedItems,
    searchQuery,
    setSearchQuery,
    activeSort,
    setSort,
    filters,
    setFilter,
    resetFilters,
  };
}
