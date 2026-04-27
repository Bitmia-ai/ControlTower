# T086: Fix Pagination Total Counts — Done Section Shows All Items

## Problem

The Tasks tab Done section shows only 8 items (or fewer) because `readProjectDetail`
slices `recentlyShipped` to the 8 most recently shipped items for use in the mission-
control "Recently Shipped" card. The `tasks-client.tsx` page builds `allItems` from
`recentlyShipped`, so the Done section only ever contains up to 8 done tasks — not
the full list of 70+ done tasks. The "Done 8" count in the CollapsibleSection header
is therefore wrong.

Additionally, the same symptom would appear in the `ListToolbar` "Showing X of Y"
text and the `Pagination` component's "1–25 of 8" range indicator.

## Root Cause

In `lib/redeye-files.ts`, `readProjectDetail()`:
```ts
const recentlyShipped = tasks
  .filter(item => item.status === "done")
  .sort(...)
  .slice(0, 8)          // ← limited to 8 for the mission-control card
  .map(item => ...);
```

In `tasks-client.tsx`:
```ts
const allItems = [
  ...(detail?.upNext ?? []),
  ...(detail?.recentlyShipped ?? []),   // ← only 8 done items
  ...(detail?.wontDoItems ?? []),
];
```

## Fix

### Sub-tasks

**T1 (S): Add `allDoneItems` to `ProjectDetail` type**
- In `lib/redeye-types.ts`, add `allDoneItems: TaskItem[]` to `ProjectDetail`.

**T2 (S): Populate `allDoneItems` in `readProjectDetail`**
- In `lib/redeye-files.ts`, compute `allDoneItems` as all done tasks (sorted by
  mergedIteration descending, cost-enriched), without slicing.
- Keep `recentlyShipped` unchanged (still sliced to 8, used by mission-control).

**T3 (S): Use `allDoneItems` in `tasks-client.tsx`**
- Replace `detail?.recentlyShipped` with `detail?.allDoneItems` in the `allItems`
  array construction so the Done section shows all done items.
- The `recentlyShipped` array is still used in other places (mission-control); no
  change needed there.

**T4 (S): Tests**
- Add unit tests to `lib/redeye-files.test.ts` (or a new file) verifying that
  `readProjectDetail` populates `allDoneItems` with all done tasks (not sliced).
- Add/update test in `tasks-client` test file verifying that when 10+ done tasks
  are provided, the Done section count shows the full count.

## Acceptance Criteria

1. Tasks page Done section shows all done items (e.g. "Done 70" when 70 done items exist).
2. `recentlyShipped` continues to return 8 items max (mission-control card unaffected).
3. Done section pagination works correctly (25 per page, "1–25 of 70" on first page).
4. All existing tests pass (832 total; 370 passing, 462 pre-existing failures).
5. Production build clean.
