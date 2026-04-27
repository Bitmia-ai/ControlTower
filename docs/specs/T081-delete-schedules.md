# T081 — Delete Schedules from Schedule Tab

**Priority:** P1  
**Type:** feature  
**Status:** planned

## Problem

The Schedules tab allows users to add and run schedules but provides no way to delete them. Users who add a schedule by mistake or no longer need one are stuck — they must manually edit `.redeye/schedules.md` to remove it.

## Goal

Add delete functionality to the Schedules tab so users can remove a schedule entry via a hover-reveal trash icon and inline confirmation panel, consistent with the existing delete pattern used in the Steer tab (DirectiveRow).

## User Story

As a user on the Schedules tab, I want to click a delete button on a schedule row, confirm the deletion in an inline confirmation panel, and see the schedule removed from the list without a page reload.

## Design (matches Steer tab delete pattern)

- On hover of a `ScheduleRow`, a trash icon button appears in the top-right action area (alongside Run now and StatusBadge).
- Clicking trash opens an inline confirmation panel inside the same row: "Delete this schedule?" with **Confirm** and **Cancel** buttons.
- On Confirm: fires `DELETE /api/projects/[id]/schedules/[schedId]`.
- On success: the schedule is removed from local state (no full re-fetch needed, though a re-fetch is acceptable).
- On error: show an inline error message.
- The trash icon has `aria-label="Delete schedule {id}"` and meets the 44px touch-target minimum.

## API

### DELETE /api/projects/[id]/schedules/[schedId]

**Route file:** `app/api/projects/[id]/schedules/[schedId]/route.ts`

- Validate `schedId` against `^SCHED-\d+$` — return 400 if invalid.
- Look up project by `id` (numeric index) — return 404 if not found.
- Read `schedules.md` — return 404 if not found.
- Find the `### {schedId}:` block in the file.
- If not found: return 404 `{ error: "Schedule not found" }`.
- Remove the block (from its `### ` header line up to but not including the next `### ` header or EOF).
- Write the updated file atomically (write to `.redeye/schedules.md.tmp`, rename to `.redeye/schedules.md`).
- Call `commitAndPush` with `.redeye/schedules.md` and commit message `ceo: delete schedule {schedId} (via dashboard)`.
- Return 200 `{ data: { success: true, deleted: schedId } }`.

## Parser helper

Add `applyScheduleDelete(content: string, schedId: string): string` to `lib/redeye-parsers.ts`:

- Validates `schedId` matches `^SCHED-\d+$` (throws `RangeError` otherwise).
- Locates the `### {schedId}:` header line.
- If not found, throws `RangeError("schedule not found")`.
- Removes from that header line up to (not including) the next `### ` line or end of content.
- Returns the updated content string.

This follows the same pattern as `applyDirectiveDelete`.

## Component changes

**`components/schedules/schedule-list.tsx` — `ScheduleRow`:**

1. Add `onDelete?: (id: string) => void` prop to `ScheduleRow` and `ScheduleList`.
2. Add `deleteState: "idle" | "confirming" | "loading" | "error"` local state.
3. On hover of the row (`group` class), show a trash `<button>` in the right-side action area (below RunButton). Use `opacity-0 group-hover:opacity-100` for hover-reveal.
4. When `deleteState === "confirming"`, render an inline panel below the header row: "Delete this schedule?" + Confirm + Cancel buttons.
5. On Confirm: set state to "loading", fire DELETE, on success call `onDelete(entry.id)`, on error set state to "error".
6. The Confirm button uses `text-red-600` styling; Cancel reverts to "idle".

**`app/project/[id]/schedules/schedules-client.tsx` — `FilteredScheduleList` / `SchedulesContent`:**

- Pass `onDelete` handler to `ScheduleList` that removes the item from local `schedules` state by id.

## Sub-tasks

| # | Size | Description |
|---|------|-------------|
| T1 | S | Add `applyScheduleDelete` to `lib/redeye-parsers.ts` + unit tests |
| T2 | S | Add `DELETE /api/projects/[id]/schedules/[schedId]/route.ts` + unit tests |
| T3 | S | Add delete UI to `ScheduleRow` + `ScheduleList` + unit tests |
| T4 | S | Wire `onDelete` through `FilteredScheduleList` → `SchedulesContent` + unit tests |

**Total: 4 sub-tasks (all S), ~15 new unit tests**

## Acceptance Criteria

1. Hovering a schedule row reveals a trash icon with `aria-label="Delete schedule {id}"`.
2. Clicking the trash icon shows an inline "Delete this schedule?" confirmation.
3. Clicking Confirm fires `DELETE /api/projects/[id]/schedules/[schedId]` and removes the row from the UI on success.
4. Clicking Cancel hides the confirmation panel without making any API call.
5. An invalid `schedId` (not matching `^SCHED-\d+$`) returns 400.
6. A non-existent `schedId` returns 404.
7. `applyScheduleDelete` correctly removes a block from multi-schedule content.
8. All new code has unit test coverage; existing 798 tests remain passing.
9. Production build (`NODE_ENV=production npm run build`) is clean.
