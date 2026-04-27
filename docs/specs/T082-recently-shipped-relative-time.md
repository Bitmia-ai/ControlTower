# T082: Recently Shipped — Relative Time and Ordering Fix

## Problem

The "Recently Shipped" card on the mission control page shows completed tasks in an arbitrary order (as they appear in tasks.md) and displays only static dates or no time information at all. The CEO wants:
1. The most recently shipped items shown first
2. Relative time labels like "2 min ago", "3 hours ago", "5 days ago" next to each item

## Root Cause

- `parseTasks()` in `lib/redeye-parsers.ts` does not parse the `- **Merged:** YYYY-MM-DD (iter N)` or `- **Merged:** iteration N` fields
- `TaskItem` in `lib/redeye-types.ts` has no `mergedAt` field
- `recentlyShipped` in `lib/redeye-files.ts` does not sort by recency
- `ShippedCard` shows only a date string (from `ChangelogEntry.date`) when using the changelog path, or nothing when using the task path

## Solution

### Sub-task 1 (S): Add `mergedAt` and `mergedIteration` to `TaskItem`

In `lib/redeye-types.ts`, extend `TaskItem`:
```ts
/** ISO date string (YYYY-MM-DD) of merge, parsed from "Merged: YYYY-MM-DD (iter N)" field. Null if only iteration known. */
mergedAt?: string | null;
/** Iteration number when item was merged, parsed from the Merged field. */
mergedIteration?: number | null;
```

### Sub-task 2 (S): Parse `Merged` field in `parseTasks()`

In `lib/redeye-parsers.ts`, in `parseTasks()`, after reading other fields via `pickField()`:

```ts
const mergedRaw = pickField(body, "Merged");
let mergedAt: string | null = null;
let mergedIteration: number | null = null;
if (mergedRaw) {
  // Format 1: "2026-04-26 (iter 108)"
  const dateIterMatch = mergedRaw.match(/^(\d{4}-\d{2}-\d{2})\s+\(iter\s+(\d+)\)/);
  if (dateIterMatch) {
    mergedAt = dateIterMatch[1];
    mergedIteration = parseInt(dateIterMatch[2], 10);
  } else {
    // Format 2: "iteration 112"
    const iterMatch = mergedRaw.match(/iteration\s+(\d+)/i);
    if (iterMatch) mergedIteration = parseInt(iterMatch[1], 10);
  }
}
```

Then include `mergedAt` and `mergedIteration` in the pushed item.

### Sub-task 3 (S): Sort `recentlyShipped` by recency in `lib/redeye-files.ts`

After filtering done tasks, sort by `mergedIteration` descending (then by position in file as tie-breaker, which is already newest-first in tasks.md):

```ts
const recentlyShipped = tasks
  .filter((item) => item.status === "done")
  .sort((a, b) => {
    const ai = a.mergedIteration ?? 0;
    const bi = b.mergedIteration ?? 0;
    return bi - ai; // descending — most recent first
  })
  .slice(0, 8) // show up to 8 recent items
  .map((item) => {
    const cost = itemCosts[item.id];
    return cost !== undefined ? { ...item, cost_usd: cost } : item;
  });
```

Increase the visible count from 5 to 8 to surface more recent work.

### Sub-task 4 (S): Add `formatRelativeTime` utility

Create `lib/format-relative-time.ts`:

```ts
/**
 * Format a YYYY-MM-DD date string as a human-readable relative time.
 * Uses a fixed reference time (nowMs) for testability.
 *
 * Returns strings like:
 *   "just now" (< 1 min)
 *   "5 min ago"
 *   "3 hours ago"
 *   "2 days ago"
 *   "3 weeks ago"
 *   "2 months ago"
 *   "1 year ago"
 *
 * Returns null if dateStr is null/empty/unparseable.
 */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  nowMs: number = Date.now()
): string | null
```

Parse `dateStr` as midnight UTC for the given date. Compute the difference in ms and return the appropriate label.

### Sub-task 5 (S): Update `ShippedCard` to show relative time

In `components/mission-control/shipped-card.tsx`:
- Import `formatRelativeTime`
- In the TaskItem render path, show `formatRelativeTime(item.mergedAt)` beneath the title (same position as the existing `entry.date` in the changelog path)
- Fall back to the existing `entry.date` display in the changelog path (no change there)

### Sub-task 6 (S): Tests

**`lib/format-relative-time.test.ts`** — unit tests for all time brackets:
- null/empty → null
- < 1 min → "just now"
- 1 min → "1 min ago"
- 90 min → "1 hour ago"
- 2 days → "2 days ago"
- 10 days → "1 week ago"
- 45 days → "6 weeks ago"
- 400 days → "1 year ago"

**`lib/redeye-parsers.test.ts`** (extend existing) — test `mergedAt` and `mergedIteration` parsing:
- format 1: `"2026-04-26 (iter 108)"` → `{ mergedAt: "2026-04-26", mergedIteration: 108 }`
- format 2: `"iteration 112"` → `{ mergedAt: null, mergedIteration: 112 }`
- missing field → `{ mergedAt: null, mergedIteration: null }`

**`components/mission-control/shipped-card.test.tsx`** (extend existing) — test relative time display:
- item with `mergedAt` set → shows formatted relative time
- item with `mergedAt: null` → no relative time shown
- existing tests must still pass

## Files Changed

1. `lib/redeye-types.ts` — add `mergedAt`, `mergedIteration` to `TaskItem`
2. `lib/redeye-parsers.ts` — parse Merged field
3. `lib/redeye-files.ts` — sort recentlyShipped by recency, show 8 instead of 5
4. `lib/format-relative-time.ts` — new utility (new file)
5. `lib/format-relative-time.test.ts` — new test file
6. `components/mission-control/shipped-card.tsx` — show relative time
7. `components/mission-control/shipped-card.test.tsx` — extend tests

## Acceptance Criteria

- Recently Shipped card shows items in newest-first order (highest iteration first)
- Items with a date in Merged field show "X min/hours/days/weeks/months/year ago"
- Items with only an iteration number (no date) show nothing (graceful fallback)
- All existing tests pass; ~10 new tests added
- `npm run build` clean
