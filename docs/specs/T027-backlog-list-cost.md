# T027: Show Cost for Completed Items in Backlog List and Detail Page

**Status:** done
**Priority:** P1
**Type:** bug (follow-up to T020)

---

## Problem

T020 shipped cost-per-item infrastructure: `item_costs` map in `state.json`, `cost_usd` field on `BacklogItem`, enrichment in `readProjectDetail`, display badge in `ShippedCard` on mission control. It also added a "Cost (est.)" field on the backlog detail page (already live — see `app/project/[id]/backlog/[taskId]/page.tsx` lines 273–278 and the GET/PATCH route enrichment in `app/api/projects/[id]/backlog/[taskId]/route.ts`).

What's still missing: the **backlog list page** (`/project/[id]/backlog`) does not show cost next to completed items. Users browsing the full backlog see "done" items but can't tell what each one cost without clicking through.

## Scope Clarification vs Original Backlog Text

The backlog entry says "Show cost on the backlog detail page for done items." Code inspection shows the detail page already renders cost (shipped in T020 T7). So the ONLY remaining work is the list page. If the CEO disagrees, see Q-005 below.

---

## Architecture Decisions

### AD-1: Data Flow — Reuse Existing Enrichment, No API Changes

The list page fetches `/api/projects/[id]` (`ProjectDetail`). Done items surface in `recentlyShipped`, which is already enriched with `cost_usd` by `readProjectDetail` (`lib/redeye-files.ts` line 165–171). The list page merges `upNext + recentlyShipped` into `allItems` — done items carry `cost_usd` through this merge unchanged.

No API or server work is needed. The change is purely a UI render in `app/project/[id]/backlog/page.tsx`.

### AD-2: Display — Inline Cost Badge on Done Rows

In `BacklogSection`'s row render (and implicitly the "done" rows that live in `ceo`/`discovered`/`triaged` sections), add a cost badge in the right-side badge cluster, positioned BEFORE the priority/status chips. Render only when `item.status === "done"` and `item.cost_usd` is defined and `> 0`.

Format: `$X.XX` (two decimals via `toFixed(2)`).
Classes: `text-xs text-gray-400 dark:text-zinc-500 font-mono` (matches the T020 `ShippedCard` convention in AD-4 of the T020 spec).

Rationale for zero/undefined suppression: zero means the snapshot wasn't captured (historical items pre-T020). Showing "$0.00" would mislead.

### AD-3: Active Task Card — No Cost Shown

The `ActiveTaskCard` renders the `in-progress` item. Cost is not shown here — the snapshot is only taken on transition to `done`, so the active item has no stable cost value. (Live session cost is visible on the mission control Cost card.)

### AD-4: No Changes to Detail Page

The detail page already shows `Cost (est.)` when `item.cost_usd > 0 && item.status === "done"`. No modification. (Verified in `app/project/[id]/backlog/[taskId]/page.tsx` line 273.)

---

## Sub-Tasks

### T1: Render cost badge in backlog list rows
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Description:** In `app/project/[id]/backlog/page.tsx`, update `BacklogSection`'s inner row markup. Inside `<div className="flex items-center gap-2 flex-shrink-0">` (the right-side badge cluster), add — before the priority chip — a conditional cost span that renders when `item.status === "done"` and `item.cost_usd !== undefined && item.cost_usd > 0`. Markup:
  ```tsx
  {item.status === "done" && item.cost_usd !== undefined && item.cost_usd > 0 && (
    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
      ${item.cost_usd.toFixed(2)}
    </span>
  )}
  ```
- **Test strategy:** Unit test (Vitest + React Testing Library) renders `BacklogSection` with a mix of items: a `done` item with `cost_usd: 1.42`, a `done` item with `cost_usd: 0`, a `done` item with `cost_usd: undefined`, and a `planned` item with `cost_usd: 2.00`. Assert `$1.42` appears exactly once, `$0.00` never appears, no cost for the undefined case, and no cost for the non-done planned item. Because the file is a full page component (`"use client"`), extract `BacklogSection` to be test-importable (or test via a render harness) — preferred approach: export `BacklogSection` as a named export for test isolation.
- **Acceptance criteria:**
  - Done items with positive `cost_usd` render `$X.XX` badge
  - Done items with 0 or undefined `cost_usd` render nothing
  - Non-done items never render a cost badge (regardless of `cost_usd`)
  - Both light and dark mode: legible contrast
  - `npm run build` passes; `npx vitest run` exits 0
- **Status:** done

### T2: Playwright visual verification
- **Size:** S
- **Dependencies:** T1
- **Agent:** QA Lead
- **Description:** After deploy, navigate to `/project/0/backlog` (haze project). Verify a completed item (e.g. T020, T031) shows its cost inline. Screenshot light and dark modes. Confirm layout doesn't break on narrow viewports.
- **Test strategy:** Playwright MCP browser via VERIFY phase. Screenshots saved to repo root as `verify-bl027-backlog-list-light.png` and `verify-bl027-backlog-list-dark.png`.
- **Acceptance criteria:**
  - Screenshot shows `$X.XX` on at least one done row
  - No layout regression (badges don't overlap or wrap awkwardly)
  - Non-done rows unaffected
- **Status:** pending

---

## Out of Scope

- Retroactive cost capture for items completed before T020 (pre-snapshot items show no badge — intentional, see AD-2)
- Cost on the active-task hero card (AD-3)
- Cost aggregation / totals per section
- Hover tooltip with cost breakdown (could be T028 later)

---

## Questions Posted

### Q-005: Is the detail page "Cost (est.)" already-shipped behaviour acceptable, or do you want it restyled?
- **From:** VP Engineering (T027 plan, iter 46)
- **Context:** T020 T7 already shipped cost on the backlog detail page as a `<dl>` field labelled "Cost (est.)". The T027 backlog entry re-requests this, suggesting the CEO may have missed it — or may want a different treatment (e.g. inline near the title instead of in the metadata grid).
- **Default:** Leave detail-page rendering as-is (already shipped). Focus T027 solely on the list page. If the CEO wants restyling, file a follow-up.
