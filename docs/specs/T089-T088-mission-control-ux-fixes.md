# T089+T088: Mission-Control UX Fixes

## T089: Recently Shipped — show 10 items instead of 8

**Problem:** CEO reports "recently shipped tasks is still showing not the top 10 recent ones, but older ones."
The `recentlyShipped` slice in `readProjectDetail` caps at 8. The CEO wants to see at least 10 recent items.

**Root cause:** `lib/redeye-files.ts` line:
```typescript
const recentlyShipped = allDoneSorted.slice(0, 8);
```

**Fix:** Change `slice(0, 8)` to `slice(0, 10)`.

**Files changed:**
- `lib/redeye-files.ts`: `slice(0, 10)`, update comment
- `components/mission-control/shipped-card.tsx`: update inline comment from "8 items" to "10 items"
- `lib/redeye-files.test.ts`: update test description from "sliced to 8" to "sliced to 10", assert `<=10`

## T088: Up Next — show "No pending tasks" when only in-progress task is queued

**Problem:** CEO reports "If no more tasks are available, up next shows the currently worked on task. it should show 'no pending tasks' in a nice way."
When all pending/planned tasks are done and only the in-progress task remains in `upNext`, the UpNextCard shows the current task instead of a clear empty state.

**Root cause:** `readProjectDetail` includes `in-progress` items in `upNext`. `UpNextCard` renders `items.slice(0, 3)` — when only the in-progress item is present, it shows up there despite being already shown in the WorkingOn card.

**Fix:** In `UpNextCard`, filter `items` to exclude `in-progress` status before rendering. Show "No pending tasks" when the filtered list is empty (instead of "Nothing queued" which is shown when items is initially empty).

**Decision:** Filter in the component, not in `readProjectDetail`. The `upNext` array might be consumed elsewhere; the card is the right place to apply the "don't show current task" rule since WorkingOn already owns that display.

**Files changed:**
- `components/mission-control/up-next-card.tsx`: filter out `in-progress` items, show "No pending tasks" empty state
- `components/mission-control/up-next-card.test.tsx`: 4 new tests (new file)

## Sub-tasks

| ID | File | Size | Description |
|----|------|------|-------------|
| S1 | lib/redeye-files.ts | S | Change slice(0,8) → slice(0,10) |
| S2 | components/mission-control/shipped-card.tsx | S | Update comment |
| S3 | lib/redeye-files.test.ts | S | Update test description + assertion |
| S4 | components/mission-control/up-next-card.tsx | S | Filter in-progress, "No pending tasks" empty state |
| S5 | components/mission-control/up-next-card.test.tsx | S | 4 new tests (new file) |

## Tests

**lib/redeye-files.test.ts (updated):**
- `recentlyShipped is still sliced to 10 items max` — verify `<=10` not `<=8`

**components/mission-control/up-next-card.test.tsx (new):**
1. Shows "No pending tasks" when items is empty
2. Shows "No pending tasks" when items contains only in-progress items
3. Renders planned/pending items (excludes in-progress)
4. Slices to 3 items when more than 3 planned/pending items

## No CEO questions needed. All changes are deterministic UX improvements.
