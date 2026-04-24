# BL-014: Backlog page should show currently active task as "In Progress" at the top

**Status:** done  
**Priority:** P0  
**Type:** bug  
**Iteration:** 29

## Problem Statement

The backlog page fetches project detail from `/api/projects/[id]`, which already reads `state.json` and surfaces `state.backlog_item`. However the backlog items are returned from `readBacklog()` which simply parses `backlog.md` — it does not cross-reference `state.json`. So the active task always shows its literal status from the file (typically `planned`), never `in-progress`. Additionally, there is no "Currently Working On" hero section at the top of the backlog page.

## Architecture Decisions

### AD-1: Enrich in the API layer, not the page component

`readProjectDetail` in `lib/redeye-files.ts` already has both `state` and `backlog` in scope at the same time. The right fix is to mutate the matching backlog item's status to `in-progress` inside `readProjectDetail`, before the items are split into `upNext` / `recentlyShipped`. This keeps all data-enrichment server-side and means the page component gets pre-enriched data with zero extra fetches.

**Rejected alternative:** Doing it client-side in `page.tsx` — works but creates two places that understand the concept of "active item", and the page already fetches from the same API.

### AD-2: Add `activeItem` field to `ProjectDetail`

Rather than relying on the page component to re-derive which item is active from the mutated `upNext` list, expose an explicit `activeItem: BacklogItem | null` field on `ProjectDetail`. This makes the intent explicit and allows the page to render the hero section without re-scanning the array.

### AD-3: Do NOT write state changes back to `backlog.md`

The `in-progress` status overlay is ephemeral — derived at read time from `state.json`. We must not write this status back to `backlog.md` because RedEye's state machine is the source of truth; the file should only be updated by RedEye itself.

### AD-4: UI — "Currently Working On" card above the grouped sections

When `activeItem` is present, render a dedicated card above the section groups with:
- Green left border (`border-l-4 border-green-500`)
- Pulsing green dot indicator (`animate-pulse`)
- Item title, ID, priority badge, type label
- "View Live" link to `/project/{id}/live`

## Sub-task Decomposition

### T1 — Enrich `readProjectDetail` to detect and expose active item
- **Size:** S
- **File:** `lib/redeye-files.ts`
- **Dependencies:** none
- **Agent:** Dev (generic / sonnet)
- **Changes:**
  1. After resolving `state` and `backlog`, find the item whose `id === state.backlog_item`.
  2. If found, mutate a copy of that item: set `status = "in-progress"`.
  3. Replace the original in the backlog array with the mutated copy.
  4. Add `activeItem: BacklogItem | null` to the returned object (point to the mutated copy, or `null`).
- **Test strategy:** Unit test in `lib/__tests__/redeye-files.test.ts` — mock `readState` returning a state with `backlog_item: "BL-014"` and `readBacklog` returning items including `BL-014` with status `planned`; assert `activeItem.status === "in-progress"` and that the item in `upNext` also has status `in-progress`.
- **Acceptance criteria:**
  - `activeItem` is non-null when `state.backlog_item` matches an item in the backlog.
  - `activeItem.status` equals `"in-progress"`.
  - The same item in `upNext` has status `"in-progress"`.
  - When `state.backlog_item` is null or does not match any item, `activeItem` is null.
- **Status:** done

### T2 — Add `activeItem` to `ProjectDetail` type
- **Size:** S
- **File:** `lib/redeye-types.ts`
- **Dependencies:** none (can be done in parallel with T1)
- **Agent:** Dev (generic / sonnet)
- **Changes:**
  - Add `activeItem: BacklogItem | null` to the `ProjectDetail` interface.
- **Test strategy:** TypeScript compile check is sufficient — if T1 and T3 reference the field correctly, tsc will catch any mismatch.
- **Acceptance criteria:**
  - `ProjectDetail` interface includes `activeItem: BacklogItem | null`.
  - No TypeScript errors in the codebase after change.
- **Status:** done

### T3 — Render "Currently Working On" hero section in backlog page
- **Size:** M
- **File:** `app/project/[id]/backlog/page.tsx`
- **Dependencies:** T1, T2 (activeItem must exist in the API response)
- **Agent:** Dev (generic / sonnet)
- **Changes:**
  1. Read `detail.activeItem` from the fetched `ProjectDetail`.
  2. Render a new `ActiveTaskCard` component (inline or extracted) above the section groups when `activeItem` is non-null.
  3. The card must have:
     - Green left border: `border-l-4 border-green-500`
     - Section header "Currently Working On" in uppercase small label style
     - A pulsing green dot: `w-2 h-2 rounded-full bg-green-500 animate-pulse`
     - Item ID badge, title (linked to detail page), priority badge, type label
     - A "View Live" link (`/project/{id}/live`) styled as a small secondary button or link
  4. Remove the active item from whichever section group it would otherwise appear in (since it is shown at the top, avoid duplication). Filter `grouped` sections to exclude any item with `id === detail.activeItem?.id`.
- **Test strategy:** Manual visual test with Playwright screenshot. Vitest unit test is not applicable for a pure render component; acceptance is visual plus no TypeScript errors.
- **Acceptance criteria:**
  - When `activeItem` is non-null, the hero section renders at the top.
  - Hero section has visible green left border and pulsing indicator.
  - Item does not also appear in the section groups below.
  - "View Live" link navigates to the live tab.
  - When `activeItem` is null, no hero section renders and the page looks identical to current.
- **Status:** done

### T4 — Vitest unit tests for enrichment logic
- **Size:** S
- **File:** `lib/__tests__/redeye-files.test.ts` (create or extend)
- **Dependencies:** T1, T2
- **Agent:** Dev (generic / sonnet)
- **Changes:** Write unit tests covering:
  - Active item found: status overridden to `in-progress`, `activeItem` populated.
  - No active item (null `backlog_item`): `activeItem` is null, all statuses unchanged.
  - Active item not found in backlog list (stale state): `activeItem` is null, no crash.
- **Test strategy:** `npx vitest run`
- **Acceptance criteria:** All tests pass with `npx vitest run`.
- **Status:** done

## File Touch Map

| File | Change |
|------|--------|
| `lib/redeye-types.ts` | Add `activeItem` to `ProjectDetail` |
| `lib/redeye-files.ts` | Enrich `readProjectDetail` to detect active item |
| `app/project/[id]/backlog/page.tsx` | Render hero card, exclude active item from groups |
| `lib/__tests__/redeye-files.test.ts` | Unit tests for enrichment |

## Open Questions

None — requirements are clear from the backlog item and codebase exploration.

## Risks

- Low risk overall. All changes are additive; no existing behavior is removed.
- The `ProjectDetail` type is used in the mission control page and other components — adding a nullable field is backwards compatible.
