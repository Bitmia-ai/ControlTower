"use client";

import { Search, X, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string | null;
  onChange: (v: string | null) => void;
}

export interface SortOption {
  key: string;
  label: string;
}

export interface ListToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  sortOptions?: SortOption[];
  activeSort?: string;
  onSortChange?: (key: string) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// FilterChip — inline select rendered as a pill button
// ---------------------------------------------------------------------------

function FilterChip({ config }: { config: FilterConfig }) {
  const selected = config.value;
  const label = selected
    ? config.options.find((o) => o.value === selected)?.label ?? selected
    : config.label;

  return (
    <div className="relative inline-block">
      <select
        value={selected ?? ""}
        onChange={(e) => config.onChange(e.target.value || null)}
        aria-label={`Filter by ${config.label}`}
        className={`appearance-none pl-3 pr-7 py-1.5 text-xs rounded-full border cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-red-500 ${
          selected
            ? "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-medium"
            : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:border-gray-400 dark:hover:border-zinc-500"
        }`}
      >
        <option value="">{config.label}</option>
        {config.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-zinc-500"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortSelect — dropdown for sort key selection
// ---------------------------------------------------------------------------

function SortSelect({
  options,
  activeSort,
  onSortChange,
}: {
  options: SortOption[];
  activeSort: string;
  onSortChange: (key: string) => void;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={activeSort}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="Sort by"
        className="appearance-none pl-3 pr-7 py-1.5 text-xs rounded-full border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:border-gray-400 dark:hover:border-zinc-500 cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-zinc-500"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListToolbar
// ---------------------------------------------------------------------------

export function ListToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  sortOptions,
  activeSort,
  onSortChange,
  totalCount,
  filteredCount,
  className = "",
}: ListToolbarProps) {
  const hasActiveFilters =
    searchQuery.length > 0 ||
    (filters?.some((f) => f.value !== null) ?? false);

  const clearAll = () => {
    onSearchChange("");
    filters?.forEach((f) => f.onChange(null));
  };

  const showCount = hasActiveFilters && filteredCount !== totalCount;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Row 1: search + controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        {/* Filter chips */}
        {filters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <FilterChip key={f.key} config={f} />
            ))}
          </div>
        )}

        {/* Sort select */}
        {sortOptions && sortOptions.length > 0 && onSortChange && activeSort && (
          <SortSelect
            options={sortOptions}
            activeSort={activeSort}
            onSortChange={onSortChange}
          />
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Clear all filters"
            className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Row 2: result count (only when filtered) */}
      {showCount && (
        <p className="text-xs text-gray-500 dark:text-zinc-500" role="status" aria-live="polite">
          Showing {filteredCount} of {totalCount} {totalCount === 1 ? "item" : "items"}
        </p>
      )}
    </div>
  );
}
