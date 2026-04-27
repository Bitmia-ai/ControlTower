# T084 — Pagination & Filtering for All Lists

**Filed by:** CEO (iter 110)
**Priority:** P0
**Tier:** M (multiple pages, shared components)

## Overview

Add pagination, filtering, and sorting to all major list views in the dashboard:
1. **Tasks tab** (`/project/[id]/tasks`) — backlog, done, and won't-do lists
2. **History tab** (`/project/[id]/history`) — sessions list and iteration log
3. **Schedules tab** (`/project/[id]/schedules`) — schedule list
4. **Steer tab** (`/project/[id]/steer`) — directives list

The CEO requirements:
- Filter by priority, status, last run (when applicable), and keyword search
- Sort by configurable keys per list
- Share components/UI between tabs for code maintenance

## Design Decisions

### Shared `<ListToolbar>` component

A single `components/list-toolbar.tsx` provides the search/filter/sort bar, reused across all four tabs.

Props:
```tsx
interface ListToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters?: FilterConfig[];         // optional filter chips
  sortOptions?: SortOption[];        // optional sort dropdown
  activeSort?: string;
  onSortChange?: (key: string) => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

interface FilterConfig {
  key: string;           // e.g. "priority"
  label: string;         // e.g. "Priority"
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}

interface SortOption {
  key: string;
  label: string;
}
```

### Shared `<Pagination>` component

A single `components/pagination.tsx` renders Previous/Next + page number display, reused across all four tabs.

Props:
```tsx
interface PaginationProps {
  page: number;           // 1-indexed
  pageCount: number;
  onPageChange: (p: number) => void;
  pageSize: number;
  totalCount: number;
  className?: string;
}
```

### Per-list configuration

**Tasks tab:**
- Search: matches title, task ID, type
- Filter: Priority (P0/P1/P2), Status (pending/planned/in-progress/done/wont-do)
- Sort: Priority (default), Newest first, Title A-Z
- Pagination: 20 items per page (planned), 25 items per page (done), no pagination on won't-do (usually small)
- Only apply filter/search/sort/pagination to "Backlog" and "Done" sections. Won't-do remains always visible.

**History tab — Sessions:**
- Search: matches file name / date string
- Sort: Newest first (default), Oldest first
- Pagination: 10 sessions per page

**History tab — Iteration Log:**
- Search: matches title, details
- Pagination: 20 entries per page
- No sorting (natural order = chronological reversed)

**Schedules tab:**
- Search: matches title, ID, frequency
- Filter: Status (overdue, on-schedule, never-run)
- Sort: Next due (default), Last run, Title A-Z
- Pagination: 15 per page

**Steer tab:**
- Search: matches directive text
- Sort: Newest first (default), Oldest first
- Pagination: 20 per page

## Sub-tasks

### T1 (S): Create shared `ListToolbar` and `Pagination` components with unit tests

Create:
- `components/list-toolbar.tsx` — search input + filter chips + sort dropdown
- `components/list-toolbar.test.tsx`
- `components/pagination.tsx` — page nav with page size info
- `components/pagination.test.tsx`

Both are pure presentational components with no data fetching. All filtering/sorting logic lives in each page's client component (or shared hook).

### T2 (S): Add `useListFilter` hook for client-side filter/search/sort/pagination

Create `lib/use-list-filter.ts` — generic hook that takes an array of items, a filter/search/sort config, and returns the filtered+sorted+paginated slice plus pagination state. Export from a single location so all four pages can import it.

Types in the hook:

```ts
interface UseListFilterOptions<T> {
  items: T[];
  pageSize: number;
  defaultSort?: string;
  searchFn?: (item: T, query: string) => boolean;
  sortFns?: Record<string, (a: T, b: T) => number>;
}

interface UseListFilterReturn<T> {
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  totalCount: number;
  filteredCount: number;
  pagedItems: T[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeSort: string;
  setSort: (key: string) => void;
  filters: Record<string, string | null>;
  setFilter: (key: string, value: string | null) => void;
  resetFilters: () => void;
}
```

Add `lib/use-list-filter.test.ts` with full coverage.

### T3 (M): Wire pagination + filtering into Tasks tab

Update `app/project/[id]/tasks/tasks-client.tsx`:
- Add `ListToolbar` to "Backlog" section (filter by priority, status; search; sort)
- Add `ListToolbar` to "Done" section (search; sort)
- Add `Pagination` to "Backlog" section (20 per page)
- Add `Pagination` to "Done" section (25 per page)
- Won't-do section: no pagination (typically < 10 items)

Update `app/project/[id]/tasks/page.test.tsx` (ensure existing tests pass; add new filter tests).

### T4 (S): Wire pagination + filtering into Schedules tab

Update `app/project/[id]/schedules/schedules-client.tsx`:
- Add `ListToolbar` above `ScheduleList` (search by title/ID; filter by status; sort by next-due/last-run/title)
- Add `Pagination` below (15 per page)
- Replace direct `ScheduleList` render with the filtered+paginated slice

### T5 (S): Wire pagination + filtering into Steer tab

Update `app/project/[id]/steer/steer-client.tsx`:
- Add `ListToolbar` above directives list (search by text; sort by newest/oldest)
- Add `Pagination` below (20 per page)

### T6 (S): Wire pagination + filtering into History tab

Update `app/project/[id]/history/history-client.tsx`:
- Sessions section: add `ListToolbar` (search by date; sort by newest/oldest) + `Pagination` (10 per page)
- Iteration log section: add search input + `Pagination` (20 per page)

### T7 (S): Integration smoke — build + vitest run pass

Run `NODE_ENV=production npm run build` and `npx vitest run`. Fix any failures. Ensure 712 baseline test count is matched or exceeded.

## Acceptance Criteria

- [ ] `ListToolbar` and `Pagination` are in `components/` with full unit tests
- [ ] `useListFilter` hook is in `lib/` with full unit tests
- [ ] Tasks tab: backlog and done sections are searchable, filterable (priority, status), sortable, and paginated
- [ ] Schedules tab: list is searchable, filterable (status), sortable, and paginated
- [ ] Steer tab: directives list is searchable, sortable, and paginated
- [ ] History tab: sessions and iteration log are searchable and paginated
- [ ] `npm run build` passes with no errors
- [ ] `npx vitest run` passes (all pre-existing + new tests)
- [ ] No new TypeScript errors (`tsc --noEmit`)

## Non-goals

- Server-side pagination (all data is already fetched; client-side filter is fine at current data volumes)
- URL state persistence for filter/sort state (nice-to-have, out of scope for P0)
- Infinite scroll (pagination only for now)
