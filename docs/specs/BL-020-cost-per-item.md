# BL-020: Show Cost Per Completed Backlog Item in Recently Shipped Card

**Status:** done  
**Priority:** P2  
**Type:** feature

---

## Problem

The Recently Shipped card on mission control shows completed backlog items (via `ShippedCard`) but has no cost data attached. BL-015 (AD-5) explicitly deferred per-item cost attribution. Now that the cost infrastructure exists (`cost-calculator.ts`, `/api/projects/[id]/cost`), we can close the loop.

The challenge: transcript files are not structured by backlog item. We cannot reliably map individual JSONL lines to the item that was being worked on. The viable approach is to capture the **session-cumulative cost snapshot** at the moment an item transitions to `done` and store it in `state.json` alongside the item ID.

---

## Architecture Decisions

### AD-1: Storage Location — `item_costs` Map in `state.json`

Cost per item is stored as a flat map in `state.json` under a new top-level key `item_costs`:

```json
{
  "item_costs": {
    "BL-015": 1.42,
    "BL-016": 0.38,
    "BL-019": 0.21
  }
}
```

Rationale:
- `state.json` is already the authoritative mutable store for RedEye runtime data.
- `backlog.md` is agent-managed text — we do not embed cost there (per BL-015 AD-5).
- A sidecar file (e.g., `.redeye/item-costs.json`) adds a new file that all readers must know about; `state.json` is simpler.
- The map is append-only in practice. Old entries remain (historical record).

The `RedEyeState` TypeScript type gains an optional field: `item_costs?: Record<string, number>`.

### AD-2: Write Path — New `POST /api/projects/[id]/cost-snapshot` Endpoint

When the RedEye CTO agent marks an item `done` in backlog.md, it does so directly (not through the PATCH API). To capture cost in that path we add a lightweight API endpoint:

`POST /api/projects/[id]/cost-snapshot` — accepts `{ blId: string }`, computes the current session cost via the existing `resolveTranscriptFile` + `sumTranscriptFileCost` utilities, writes it into `state.json["item_costs"][blId]`, returns `{ data: { blId, cost_usd } }`.

The DEPLOY phase agent calls this endpoint once per completed item before advancing phase. This keeps the write logic server-side and consistent with how all other state mutations work in Control Tower.

The PATCH backlog API also calls this endpoint when a status transition to `done` is detected, so UI-driven completions are captured too.

### AD-3: Read Path — Enrichment in `readProjectDetail`

`readProjectDetail` in `lib/redeye-files.ts` already reads `state.json`. We extend it to:
1. Read `state.item_costs` (if present).
2. When building `recentlyShipped`, attach `cost_usd` to each `BacklogItem` where a match exists in `item_costs`.

`BacklogItem` gains an optional field: `cost_usd?: number`.

This keeps all enrichment server-side. No API shape changes are needed for `ProjectDetail` — `recentlyShipped` is already `BacklogItem[]`. The 5-second detail poll on mission control means cost appears within one poll cycle after the snapshot is written.

### AD-4: Display — `ShippedCard` shows inline cost badge

`ShippedCard` receives `BacklogItem[]` that may now carry `cost_usd`. When present and greater than 0, render a subtle secondary label to the right:

```
✓  BL-015 · Add cost tracking   $1.42
```

Formatting: `$X.XX` (two decimal places). If `cost_usd` is 0 or absent, the badge is omitted (not shown as "$0.00" — zero likely means the snapshot was not captured). Use `text-xs text-gray-400 dark:text-zinc-500 font-mono` for the cost value, positioned with `ml-auto shrink-0`.

### AD-5: No Changelog Path for Cost

When `ShippedCard` renders via the changelog path (`hasChangelog === true`), per-item cost is not shown. Changelog entries are `ChangelogEntry` objects, not `BacklogItem`, and they do not carry cost. This is acceptable — the changelog fallback is rarely used for projects with an active RedEye state.

### AD-6: Backlog Detail Page Cost — One Extra `<dd>` Field

The backlog detail page (`app/project/[id]/backlog/[taskId]/page.tsx`) fetches the full
`BacklogItem` from `/api/projects/[id]/backlog/[taskId]`. After T4 enriches
`recentlyShipped`, the same enrichment is applied to single-item backlog fetches (the
PATCH/GET backlog item route already returns a `BacklogItem`). When `item.status === "done"`
and `item.cost_usd` is defined, a "Cost (est.)" field is added to the `<dl>` metadata
grid showing `$X.XX`.

---

## Sub-Tasks

### T1: Extend types — `BacklogItem.cost_usd` and `RedEyeState.item_costs`
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Description:** Add `cost_usd?: number` to the `BacklogItem` interface in `lib/redeye-types.ts`. Add `item_costs?: Record<string, number>` to `RedEyeState`.
- **Test strategy:** TypeScript compilation verifies no consumers break. Run `npm run build`.
- **Acceptance criteria:**
  - `BacklogItem` has optional `cost_usd?: number`
  - `RedEyeState` has optional `item_costs?: Record<string, number>`
  - `npm run build` passes with no type errors
- **Status:** done

### T2: `sumCurrentSessionCost` utility in `lib/cost-calculator.ts`
- **Size:** S
- **Dependencies:** none (uses existing utilities)
- **Agent:** Dev (generic)
- **Description:** Export `sumCurrentSessionCost(projectPath: string): Promise<number>` that calls `resolveTranscriptFile(projectPath)` then `sumTranscriptFileCost(file)`. Returns 0 if no file. Encapsulates the two-step lookup so callers import one function.
- **Test strategy:** Unit test: mock `resolveTranscriptFile` to return a path, mock `sumTranscriptFileCost` to return a value, verify wrapper returns it. Test with null transcript returns 0.
- **Acceptance criteria:**
  - `sumCurrentSessionCost` exported from `lib/cost-calculator.ts`
  - Returns 0 when no transcript file is found
  - Delegates cost computation to existing `sumTranscriptFileCost`
  - Unit tests pass
- **Status:** done

### T3: `POST /api/projects/[id]/cost-snapshot` endpoint
- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (generic)
- **Description:** New route at `app/api/projects/[id]/cost-snapshot/route.ts`. Accepts JSON body `{ blId: string }`. Reads `state.json`, calls `sumCurrentSessionCost(projectPath)`, writes result into `state.item_costs[blId]`, saves `state.json` atomically (write to tmp then rename), returns `{ data: { blId, cost_usd } }`. Initialises `item_costs` map if absent.
- **Test strategy:** Unit test with mocked fs and cost utility. Verify idempotent (calling twice overwrites with latest value). Verify 400 when `blId` missing. Verify 404 when project not found.
- **Acceptance criteria:**
  - `POST /api/projects/0/cost-snapshot` with `{ blId: "BL-020" }` returns `{ data: { blId: "BL-020", cost_usd: <number> } }` with HTTP 200
  - Writes to `state.json["item_costs"]["BL-020"]`
  - Returns 400 if `blId` is missing from body
  - Returns 404 if project not found
  - Does not corrupt other `state.json` fields
  - `npm run build` passes
- **Status:** done

### T4: Enrich `recentlyShipped` with `cost_usd` in `readProjectDetail`
- **Size:** S
- **Dependencies:** T1, T3
- **Agent:** Dev (generic)
- **Description:** In `lib/redeye-files.ts` `readProjectDetail`, after reading state, map over `recentlyShipped` items and attach `cost_usd` from `state.item_costs[item.id]` where present. No new I/O — state is already loaded.
- **Test strategy:** Unit test `readProjectDetail` with a mock state containing `item_costs`. Verify returned `recentlyShipped` items carry `cost_usd` where matched and `undefined` where not.
- **Acceptance criteria:**
  - Item with matching `item_costs` entry has `cost_usd` set to that value
  - Item without match has `cost_usd` as `undefined` (not 0, not null)
  - Items not in `done` status are unaffected
  - Existing `readProjectDetail` behaviour is unchanged
- **Status:** done

### T5: Update `ShippedCard` to display `cost_usd` badge
- **Size:** S
- **Dependencies:** T1, T4
- **Agent:** Dev (generic)
- **Description:** In `components/mission-control/shipped-card.tsx`, in the `BacklogItem` render branch (not changelog branch per AD-5), show a cost badge when `item.cost_usd` is defined and greater than 0. Format as `$X.XX` with `toFixed(2)`. Position right-aligned using `flex justify-between` on the row. Style: `text-xs text-gray-400 dark:text-zinc-500 font-mono shrink-0`.
- **Test strategy:** Render test with items that have `cost_usd` set and some without. Verify cost renders for the former and is absent for the latter. Verify no layout regression on changelog path.
- **Acceptance criteria:**
  - `cost_usd: 1.42` renders as `$1.42`
  - `cost_usd: undefined` renders nothing (no badge, no "$0.00")
  - `cost_usd: 0` renders nothing
  - Both dark and light mode: text is legible (screenshot or visual check)
  - Changelog render path unaffected
  - `npm run build` passes
- **Status:** done

### T6: Vitest unit tests
- **Size:** S
- **Dependencies:** T2, T3, T4, T5
- **Agent:** Dev (generic / QA)
- **Description:** Write or extend tests:
  - `lib/cost-calculator.test.ts` — add `sumCurrentSessionCost` cases (null file, non-null file)
  - `app/api/projects/[id]/cost-snapshot/route.test.ts` — new file covering POST success, idempotency, missing blId (400), missing project (404)
  - `lib/redeye-files.test.ts` — add/extend test for `readProjectDetail` cost enrichment
  - `components/mission-control/shipped-card.test.tsx` — render tests for cost badge presence and absence
- **Test strategy:** `npx vitest run` exits 0.
- **Acceptance criteria:**
  - All new code paths covered
  - No existing tests broken
  - `npx vitest run` exits 0
- **Status:** done

---

### T7: Show `cost_usd` on Backlog Detail Page
- **Size:** S
- **Dependencies:** T1, T4 (backlog item API must enrich `cost_usd`)
- **Agent:** Dev (generic)
- **Description:** In `app/project/[id]/backlog/[taskId]/page.tsx`, inside the `<dl>` metadata grid for a `done` item, add a "Cost (est.)" `<dt>/<dd>` pair when `item.cost_usd` is defined and greater than 0. Format as `$X.XX`. The existing backlog item PATCH/GET route must be updated to attach `cost_usd` from `state.item_costs` (same enrichment pattern as T4 for `readProjectDetail`).
- **Test strategy:** Manual smoke: open a completed backlog item detail, verify "Cost (est.)" appears. Open a non-done item, confirm field absent.
- **Acceptance criteria:**
  - "Cost (est.)" field renders for done items with `cost_usd > 0`
  - Field absent for non-done items or when `cost_usd` is undefined/0
  - `npm run build` passes
- **Status:** done

---

## Out of Scope (This Iteration)

- Retroactive cost capture for items completed before BL-020 ships (no badge for old items)
- Cost attribution in the changelog render path of `ShippedCard`
- Per-phase cost breakdown
- Real-time cost streaming in the shipped card (5s poll cadence is sufficient)

---

## Questions Posted

None — sufficient context to proceed with defaults from BL-015 architecture.
