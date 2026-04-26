# BL-038: Cost Visibility Bug — Detail Page Cost Field Not Rendering

**Status:** pending
**Priority:** P1
**Type:** bug

---

## Root Cause Diagnosis

### The Problem

The `Cost (est.)` field on the backlog detail page (`/project/[id]/backlog/[taskId]`) never renders, despite the rendering code being present and correct at lines 273–278 of `app/project/[id]/backlog/[taskId]/page.tsx`:

```tsx
{item.status === "done" && item.cost_usd !== undefined && item.cost_usd > 0 && (
  <div>
    <dt>Cost (est.)</dt>
    <dd>${item.cost_usd.toFixed(2)}</dd>
  </div>
)}
```

The condition `item.cost_usd !== undefined && item.cost_usd > 0` is logically sound but can never pass because `item.cost_usd` is **never populated in practice**.

### Data Flow Trace

1. The GET `/api/projects/[id]/backlog/[taskId]/route.ts` enriches the item via:
   ```ts
   const cost = state?.item_costs?.[taskId];
   const enriched = cost !== undefined ? { ...item, cost_usd: cost } : item;
   ```
   This is correct — but only works when `state.item_costs` is populated.

2. `item_costs` is written exclusively by `POST /api/projects/[id]/cost-snapshot` (`app/api/projects/[id]/cost-snapshot/route.ts`). This endpoint was shipped in BL-020 but **is never called automatically** when an item transitions to `done`. It requires an explicit POST call.

3. The live `state.json` has **no `item_costs` field at all** (confirmed: `python3 -c "import json; s=json.load(open('.redeye/state.json')); print(s.get('item_costs', 'KEY NOT FOUND'))"`  → `KEY NOT FOUND`).

4. Because `item_costs` is absent, `state?.item_costs?.[taskId]` always evaluates to `undefined`. `enriched` is always the bare item without `cost_usd`. The detail page condition fails silently.

### Why BL-027 Did Not Fix This

BL-027 spec (AD-4) stated: "The detail page already renders cost when `item.cost_usd > 0`. No modification needed." This was incorrect — the spec assumed `item_costs` was populated, but the cost-snapshot mechanism was never wired to run automatically at item completion. The BL-027 BUILD focused solely on the list-page badge.

### Why No Items Have Cost Data

All backlog items (BL-001 through BL-037) were completed before or after BL-020 shipped the snapshot mechanism, but no code path ever calls `POST /api/projects/[id]/cost-snapshot` at item completion time. The snapshot API exists as a manual/external call only.

### Fix Strategy

**Minimal fix: backfill `item_costs` in state.json for all completed items by calling the cost API and writing a reasonable estimate.**

However, since completed items have no per-item cost recorded anywhere (the cost-snapshot API computes "current session cost" at call time — a point-in-time snapshot), we cannot retroactively compute accurate per-item costs.

**The correct minimal fix has two parts:**

**Part A (data):** Implement automatic cost snapshot capture on the Control Tower side. When a user views the detail page for a `done` item that has no `cost_usd`, show a fallback message "Cost data not available (item completed before cost tracking)" rather than hiding the field entirely.

**Part B (future items):** Wire the `cost-snapshot` API to be called at the right moment. Since Control Tower does not orchestrate when items complete (the CTO agent does, via the RedEye plugin), the best Control Tower can do is:
- Show the "Cost data not available" message for items with no snapshot
- Expose the cost-snapshot endpoint so the CTO agent can call it at VERIFY/MERGE time

**Scope for this iteration:** Fix the UI so _something_ is shown for done items — either the cost (when data exists) or "Not recorded" (when it doesn't). This makes the field visible and unblocks CEO verification. A separate steering note will ask the CTO agent to call the cost-snapshot endpoint when completing items.

---

## Architecture Decisions

### AD-1: Relax the `cost_usd > 0` guard in the detail page

The current render condition `item.cost_usd !== undefined && item.cost_usd > 0` silently hides the field when no cost data exists. Change the condition to show either the cost (when available) or a "Not recorded" fallback for all `done` items.

New render logic:
```tsx
{item.status === "done" && (
  <div>
    <dt className="text-xs text-gray-500 dark:text-zinc-500 mb-0.5">Cost (est.)</dt>
    <dd className="text-gray-800 dark:text-zinc-200 font-mono">
      {item.cost_usd !== undefined && item.cost_usd > 0
        ? `$${item.cost_usd.toFixed(2)}`
        : <span className="text-gray-400 dark:text-zinc-600 font-sans not-italic">Not recorded</span>
      }
    </dd>
  </div>
)}
```

This guarantees the `Cost (est.)` label is always visible for `done` items, giving the CEO something to see and verify.

### AD-2: Add a steering note for the CTO agent

Add a directive to `.redeye/steering.md` asking the CTO agent to POST to `/api/projects/[id]/cost-snapshot` with the current BL ID at VERIFY time. This unblocks future items from having real cost data.

### AD-3: No changes to the GET route or cost-snapshot endpoint

The enrichment logic in `route.ts` is correct. When `item_costs` has data, it will flow through correctly. No server-side changes needed.

### AD-4: Same fix for the list page cost badge

The backlog list page (`app/project/[id]/backlog/page.tsx`) uses the same `item.cost_usd > 0` guard on done items. For consistency, do NOT add a "Not recorded" badge there (list pages should stay clean). The list badge remains hidden when no cost data — this is acceptable. Only the detail page needs the explicit "Not recorded" fallback.

---

## Sub-Tasks

### T1: Fix detail page cost field — always show for done items
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/backlog/[taskId]/page.tsx`
- **Change:** Replace lines 273–278 with the AD-1 render logic. Show `Cost (est.)` for all `done` items: display `$X.XX` if `cost_usd` is present and positive, otherwise display "Not recorded" in muted gray.
- **Test strategy:** Update/add Vitest tests in `app/api/projects/[id]/backlog/[taskId]/route.test.ts` to confirm GET returns item without `cost_usd` when `item_costs` is absent. Add snapshot/RTL test for the detail page component to confirm the Cost field renders for a done item even when `cost_usd` is undefined. (The page is `"use client"` so test via jsdom render or by testing the API enrichment path.)
- **Acceptance criteria:**
  - For a `done` item with `cost_usd: undefined` → renders `Cost (est.)` label with "Not recorded" text
  - For a `done` item with `cost_usd: 1.42` → renders `Cost (est.)` label with "$1.42"
  - For a `done` item with `cost_usd: 0` → renders "Not recorded" (zero means no snapshot)
  - For a non-`done` item → no `Cost (est.)` field rendered at all
  - `npm run build` passes; `npx vitest run` exits 0
- **Status:** done

### T2: Add steering directive for cost-snapshot at VERIFY time
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `.redeye/steering.md`
- **Change:** Append a directive instructing the CTO agent: at VERIFY phase (when item is confirmed done), POST to `/api/projects/[id]/cost-snapshot` with `{ blId: "<current BL id>" }` before marking the item done in backlog.md.
- **Test strategy:** Manual review of directive text. No automated test.
- **Acceptance criteria:**
  - Directive is clear and actionable
  - Does not conflict with existing directives
- **Status:** done

### T3: Playwright verification
- **Size:** S
- **Dependencies:** T1
- **Agent:** QA Lead
- **Description:** After deploy, navigate to any completed backlog item detail page (e.g. `/project/0/backlog/BL-020`). Confirm `Cost (est.)` label is visible. Since no actual cost data exists in state.json yet, it should show "Not recorded". Screenshot both light and dark mode. If a future item completes after T2 is shipped, verify `$X.XX` displays.
- **Test strategy:** Playwright MCP browser screenshot.
- **Acceptance criteria:**
  - `Cost (est.)` label visible for at least one done item in Playwright screenshot
  - Shows either `$X.XX` or "Not recorded" — never blank/invisible
  - No layout regression
- **Status:** done

---

## Acceptance Criteria (Top-Level)

1. `Cost (est.)` is visible on the backlog detail page for all completed items — either showing a dollar amount or "Not recorded"
2. Playwright screenshot confirms the field is present (CEO can see it)
3. Items with actual cost data (post-T2 steering directive) show `$X.XX`
4. Items without cost data (historical, pre-snapshot) show "Not recorded" in muted text
5. `npx vitest run` exits 0; `NODE_ENV=production npm run build` succeeds

---

## Out of Scope

- Retroactive cost computation for historically completed items (no data source available)
- Changes to the list-page cost badge behavior
- Changes to the cost-snapshot endpoint
- Changes to the GET route enrichment logic (already correct)
