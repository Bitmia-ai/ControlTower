# T138 — Refactor: split tasks-client.tsx into focused components

**Status:** planned  
**Priority:** P2  
**Type:** refactor  
**Tier:** M

---

## Problem

`app/project/[id]/tasks/tasks-client.tsx` is 735 lines and contains six distinct concerns in a single file:

1. Pure helper functions (`parseTaskIdNumber`, `computeBuckets`, sort/filter maps)
2. An active-task card (`ActiveTaskCard`)
3. A generic task section list (`TaskSection`)
4. A done item row (`DoneItemRow`)
5. A won't-do item row (`WontDoItemRow`)
6. A backlog section with toolbar + pagination (`BacklogSection`)
7. A done section with toolbar + pagination (`DoneSection`)
8. The page shell with data-fetching (`TasksPageClient`)

The acceptance criteria from the task description: extract per-section components into `components/tasks/`, keep helpers in `lib/`, and reduce `tasks-client.tsx` to under 300 lines that wires them together. **No behavior change. Existing tests in `page.test.tsx` must pass without modification.**

---

## Constraint: test backward compatibility

`app/project/[id]/tasks/page.test.tsx` imports the following directly from `./tasks-client`:

```ts
import {
  BacklogSection,
  TaskSection,
  WontDoItemRow,
  computeBuckets,
  parseTaskIdNumber,
} from "./tasks-client";
```

These named exports **must remain re-exported from `tasks-client.tsx`** after the refactor, or the test file must be updated as part of this task. The spec opts to **keep the re-exports in `tasks-client.tsx`** to honor the acceptance criteria ("existing tests must still pass without modification").

---

## Architecture decisions

### AD-1: New directory `components/tasks/`

All extracted UI components live under `components/tasks/`. This mirrors the pattern used for other feature-area components (e.g. `components/schedules/`).

### AD-2: Pure helpers stay in `tasks-client.tsx` (not moved to lib/)

`parseTaskIdNumber` and `computeBuckets` are already exported and tested via `page.test.tsx`. Moving them to `lib/` would break the import path in the test file. Per the acceptance criteria ("without modification"), they stay in `tasks-client.tsx` as named exports. The sort/filter maps (`taskSearchFn`, `taskFilterFns`, `backlogSortFns`, `doneSortFns`) are passed as props or co-located with the components that use them — they are not shared across files so they move into the relevant component file.

### AD-3: `DoneSection` becomes a standalone component file

`DoneSection` is currently not exported but is sizable (~78 lines). It is extracted to `components/tasks/done-section.tsx` for independent review and testability.

### AD-4: `ActiveTaskCard` moves to `components/tasks/`

It is self-contained (~58 lines) and concerns a single visual element. Moving it reduces `tasks-client.tsx` size without requiring any prop threading.

### AD-5: `BacklogSection` and related filter config co-located

The `priorityFilterConfig`, `statusFilterConfig`, `authorFilterConfig` memos and `backlogSortFns`/`taskFilterFns`/`taskSearchFn` are all `BacklogSection`-specific. They move to `components/tasks/backlog-section.tsx` alongside the component.

### AD-6: `DoneSection` filter logic co-located

`doneSortFns` move into `components/tasks/done-section.tsx`.

### AD-7: `taskSearchFn` and `taskFilterFns` shared between BacklogSection and DoneSection

`taskSearchFn` is used by both `BacklogSection` and `DoneSection`. It moves to a shared `components/tasks/task-filter-utils.ts` (non-JSX) to avoid duplication.

### AD-8: No types file needed

`TaskItem` and `ProjectDetail` already live in `lib/redeye-types.ts`. No new types file is required.

---

## File plan

| New file | Extracted from | Contents | Est. lines |
|---|---|---|---|
| `components/tasks/active-task-card.tsx` | `tasks-client.tsx` | `ActiveTaskCard` component | ~65 |
| `components/tasks/task-row.tsx` | `tasks-client.tsx` | `DoneItemRow` + `WontDoItemRow` + `TaskSection` (all generic row-level components) | ~170 |
| `components/tasks/task-filter-utils.ts` | `tasks-client.tsx` | `taskSearchFn`, `taskFilterFns` (shared by both sections) | ~20 |
| `components/tasks/backlog-section.tsx` | `tasks-client.tsx` | `BacklogSection` + `backlogSortFns` + filter configs | ~180 |
| `components/tasks/done-section.tsx` | `tasks-client.tsx` | `DoneSection` + `doneSortFns` | ~95 |

**`tasks-client.tsx` after refactor** keeps: `parseTaskIdNumber`, `computeBuckets`, re-exports of `BacklogSection`, `TaskSection`, `WontDoItemRow`, and the `TasksPageClient` default export. Target: ~150 lines.

---

## Sub-tasks

### ST-1 — Extract `ActiveTaskCard` (S)

**File:** `components/tasks/active-task-card.tsx`  
**Contents:** Move `ActiveTaskCard` component verbatim.  
**Dependencies:** `Link`, `TaskId`, `SectionHeader`, `PRIORITY_COLORS` from `lib/task-badge-styles`  
**Test strategy:** No dedicated test needed (visual-only component; covered by e2e). Existing suite must still pass.  
**Acceptance criteria:**
- `components/tasks/active-task-card.tsx` exists and exports `ActiveTaskCard`
- `tasks-client.tsx` imports `ActiveTaskCard` from that file
- `npm run typecheck` exits 0
- `npx vitest run` passes with same count as before ST-1

**Status:** done

---

### ST-2 — Extract row components + `TaskSection` (S)

**File:** `components/tasks/task-row.tsx`  
**Contents:** Move `DoneItemRow`, `WontDoItemRow`, and `TaskSection` into a single file.  
`WontDoItemRow` and `TaskSection` are exported (used by `page.test.tsx`); `DoneItemRow` can be a named export too for testability.  
**Dependencies:** `Link`, `Check`, `X`, `TaskId`, `STATUS_COLORS`, `PRIORITY_COLORS`  
**Test strategy:** `tasks-client.tsx` re-exports `TaskSection` and `WontDoItemRow` — `page.test.tsx` continues to import from `./tasks-client` without change.  
**Acceptance criteria:**
- `components/tasks/task-row.tsx` exports `DoneItemRow`, `WontDoItemRow`, `TaskSection`
- `tasks-client.tsx` re-exports `TaskSection` and `WontDoItemRow` from the new file
- All existing `WontDoItemRow` and `TaskSection` tests in `page.test.tsx` pass
- `npm run typecheck` exits 0

**Status:** done

---

### ST-3 — Extract shared filter utilities (S)

**File:** `components/tasks/task-filter-utils.ts`  
**Contents:** Move `taskSearchFn` and `taskFilterFns` here as named exports. Move `BACKLOG_PAGE_SIZE` and `DONE_PAGE_SIZE` constants here as well.  
**Dependencies:** `TaskItem` from `lib/redeye-types`, `AUTHOR_BADGE_STYLES`, `taskAuthor` from `lib/task-badge-styles`  
**Test strategy:** Pure functions; existing `BacklogSection` filter tests in `page.test.tsx` provide coverage.  
**Acceptance criteria:**
- `components/tasks/task-filter-utils.ts` exports `taskSearchFn`, `taskFilterFns`, `BACKLOG_PAGE_SIZE`, `DONE_PAGE_SIZE`
- Both `backlog-section.tsx` and `done-section.tsx` import from this file
- `npm run typecheck` exits 0

**Status:** done

---

### ST-4 — Extract `BacklogSection` (M)

**File:** `components/tasks/backlog-section.tsx`  
**Contents:** Move `BacklogSection`, `backlogSortFns`, and all its internal filter config memos.  
**Dependencies:** `useListFilter`, `ListToolbar`, `Pagination`, `TaskId`, `Link`, `PRIORITY_COLORS`, `AUTHOR_BADGE_STYLES`, `taskAuthor`, `task-filter-utils.ts`  
**Test strategy:** `tasks-client.tsx` re-exports `BacklogSection` — all `BacklogSection` tests in `page.test.tsx` (author badge, filter chip, filter interactions, clear filters) continue to run via the re-export path.  
**Acceptance criteria:**
- `components/tasks/backlog-section.tsx` exports `BacklogSection`
- `tasks-client.tsx` re-exports `BacklogSection` from the new file
- All `BacklogSection` tests in `page.test.tsx` pass (author badge rendering, filter select, filter clear — 7 tests)
- `npm run typecheck` exits 0

**Status:** done

---

### ST-5 — Extract `DoneSection` (S)

**File:** `components/tasks/done-section.tsx`  
**Contents:** Move `DoneSection` and `doneSortFns`.  
**Dependencies:** `useListFilter`, `ListToolbar`, `Pagination`, `task-filter-utils.ts`, `task-row.tsx`  
**Test strategy:** `DoneSection` has no direct tests in `page.test.tsx`; it is exercised via the page shell integration test. Existing suite must still pass.  
**Acceptance criteria:**
- `components/tasks/done-section.tsx` exports `DoneSection`
- `tasks-client.tsx` imports `DoneSection` from the new file
- `npm run typecheck` exits 0

**Status:** done

---

### ST-6 — Final cleanup: slim `tasks-client.tsx` to < 300 lines (S)

**Action:** After ST-1 through ST-5, `tasks-client.tsx` should contain only:
- Imports from the new `components/tasks/` files
- `parseTaskIdNumber` (exported, tested)
- `computeBuckets` (exported, tested)
- Re-exports of `BacklogSection`, `TaskSection`, `WontDoItemRow` to preserve `page.test.tsx` compatibility
- `TasksPageClient` default export (page shell: fetch, state, render)

**Acceptance criteria:**
- `wc -l tasks-client.tsx` reports < 300
- `page.test.tsx` is **not modified** — all imports from `./tasks-client` still resolve
- `npx vitest run` passes with same count as baseline
- `npm run typecheck` exits 0
- `NODE_ENV=production npm run build` passes

**Status:** done

---

## Test strategy summary

- No test files are modified during this refactor.
- `page.test.tsx` imports `BacklogSection`, `TaskSection`, `WontDoItemRow`, `computeBuckets`, `parseTaskIdNumber` from `./tasks-client` — all remain valid via re-exports.
- Each sub-task runs `npx vitest run` to verify no regressions before moving to the next.
- Build verification (`NODE_ENV=production npm run build`) is performed in ST-6 only.

---

## Questions posted to CEO

None. The refactor scope is unambiguous: no new behavior, no new dependencies, pure code organization.
