# BL-045 — Improve Main Project Screen Design

**Status:** planned  
**Priority:** P1  
**Spec author:** VP Engineering (iter 61)

---

## 1. Current State — Issues

### 1.1 Layout and Grid

The `/project/[id]` page uses a flat 2-column grid (`grid-cols-1 md:grid-cols-2 gap-4`) with no visual grouping. All 7 cards receive equal visual weight regardless of importance.

Specific layout problems:
- **WorkingOn + Health** sit side-by-side in row 1 — Health is secondary context but gets the same size as the primary "what is happening now" card.
- **CostCard** spans full width (`md:col-span-2`) in row 2 — it's informational and doesn't warrant a full-width row by itself.
- **QuestionsCard** conditionally spans full width only when questions are pending, otherwise half-width on the left with UpNext on the right — the conditional col-span makes layout jump between states.
- **ControlsCard** is buried at the bottom (row 4, right column), hard to find quickly.
- **UpNext + ShippedCard** have the same visual weight as Working On and Controls, but are lower-priority information.
- The `gap-4` (16px) between cards feels tight for a dashboard that should breathe.

### 1.2 Information Hierarchy

There is no visual hierarchy — every card is styled identically (same bg, same border, same p-5 padding, same label size). The only differentiation is the colored left-border-4 accent, which is overused to the point of losing meaning (WorkingOn, Health, Cost, UpNext, ShippedCard, QuestionsCard, ControlsCard all have `border-l-4`).

Priority of information for a user checking in on an agent:
1. **What is it working on + what phase?** (WorkingOn)
2. **What action can I take?** (Controls)
3. **Does it need me?** (Questions — urgent when pending)
4. **How is the project health?** (Health)
5. **What is coming up?** (UpNext)
6. **What was delivered?** (ShippedCard)
7. **What did it cost?** (Cost — least urgent)

Currently Controls is at the bottom and Cost has disproportionate width.

### 1.3 Card Design Issues

- All cards use the same `text-xs uppercase tracking-wide` label style (`Working On`, `Controls`, `Cost`, etc.). These labels are good but the cards themselves have no distinction in internal density or visual weight.
- The `border-l-4` pattern is used on every single card — it no longer signals anything specific. Only QuestionsCard and ControlsCard (stalled) use it meaningfully as a status signal.
- UpNextCard and ShippedCard use identical card chrome as WorkingOn, despite containing denser list content that deserves less padding emphasis.
- `gap-4` (16px) between cards is standard but slightly cramped for the content density. `gap-5` (20px) or `gap-6` (24px) would breathe better.

### 1.4 Header / Layout Shell

The project layout (`app/project/[id]/layout.tsx`) has a reasonable header with project name, path, run status dot, and nav tabs. Issues:
- The `text-2xl font-bold` project name is fine but the running indicator (`h-2 w-2` dot + text) is disconnected from the project name — reads like an afterthought.
- The running state is shown in two places: the layout header dot AND the WorkingOn card left-border color. One clear location is sufficient.
- The `← All projects` back link at `text-xs` is functionally present but visually fragile.
- `pt-8 mb-8` on the header gives 32px top + 32px bottom spacing — generous but the nav tabs bleed into the gap inconsistently.

### 1.5 Missing Affordances

- No breadcrumb or project name in the main content area — users landing on mission control from a deep link don't see context quickly (the name is only in the layout header, 64px above the cards).
- The Controls card has no visual priority differentiation — it looks like a peer of ShippedCard.

---

## 2. Design Decisions

### 2.1 New Grid Layout

Replace the flat 2-column equal grid with a **semantically grouped layout**:

```
Row 1: [WorkingOn — full width or 2/3] | [Controls — 1/3]
Row 2: [Questions — full width when pending, hidden when none]
Row 3: [UpNext — 1/2] | [ShippedCard — 1/2]
Row 4: [Health — 1/2] | [Cost — 1/2]
```

Rationale:
- WorkingOn and Controls are paired — they answer "what is happening" and "what can I do" together at the top.
- Questions expands full-width when urgent (existing behavior, preserved).
- UpNext + Shipped are grouped together — both backlog-list content, similar density.
- Health + Cost are informational secondary cards; they sit at the bottom.

Implementation: use CSS Grid with named areas for clarity.

### 2.2 Remove border-l-4 from Secondary Cards

Reserve the colored left border (`border-l-4`) only for status-bearing cards:
- **WorkingOn**: green (running) / red (stopped) — meaningful session status.
- **ControlsCard**: amber only when `stalled` — preserved as stall indicator.
- **QuestionsCard**: red only when questions pending — urgency signal preserved.

Remove `border-l-4` from: HealthCard, CostCard, UpNextCard, ShippedCard.

These cards will still have the base `border border-gray-200 dark:border-zinc-800` for definition.

### 2.3 Controls Card — Promote to Top Row

The Controls card moves from the bottom to a paired first row alongside WorkingOn. It gets a narrower column (1/3 width on desktop) since its content is compact (2 rows of buttons + caption). This makes primary actions immediately reachable.

### 2.4 Spacing

Increase `gap-4` to `gap-5` (20px) throughout the grid for better breathing room.

Increase page bottom padding from `pb-8` to `pb-12`.

### 2.5 Card Internal Changes

**WorkingOnCard:** Increase task title text from `text-sm` to `text-base` for the active task description. This is the most important piece of information on the page.

**ControlsCard:** No functional changes — layout only moves it.

**HealthCard + CostCard:** Remove `border-l-4`. Otherwise unchanged.

**UpNextCard + ShippedCard:** Remove `border-l-4`. Otherwise unchanged.

**QuestionsCard:** Preserve current conditional `border-l-4 border-red-600` when questions pending. When no questions, use clean border with no accent.

### 2.6 Layout Header (ProjectLayout)

The running status dot currently sits isolated to the right. Move it inline next to the project name as a small colored dot preceding or following the `h1`, so the status is immediately associated with the project identity.

Change:
```tsx
// current: separate right-aligned div
<div className="flex items-center gap-1.5 mt-1">
  <span className={`h-2 w-2 rounded-full ${running ? "bg-green-500" : "bg-gray-400"}`} />
  <span className="text-xs text-gray-500">{running ? "Running" : "Stopped"}</span>
</div>
```

To: inline dot next to title (or a badge below/beside it).

### 2.7 Card Section Dividers (optional visual group)

Optionally add a subtle `text-xs uppercase tracking-widest text-gray-400` section heading above the secondary row (UpNext + Shipped) and tertiary row (Health + Cost) to make the information hierarchy scannable. This avoids relying solely on grid position to convey priority.

Proposed section labels:
- Top group: no label (Controls + WorkingOn are self-explanatory primary content)
- "Backlog" before UpNext + Shipped row
- "Telemetry" before Health + Cost row

Decision: include the section labels as `<p>` elements with `md:col-span-3` (full row), `text-xs uppercase tracking-widest font-medium text-gray-400 dark:text-zinc-600 mt-2`.

---

## 3. Files Changed

| File | Change type |
|------|-------------|
| `app/project/[id]/page.tsx` | Grid layout restructure |
| `app/project/[id]/layout.tsx` | Running status badge inline with project name |
| `components/mission-control/working-on-card.tsx` | Task title `text-sm` → `text-base` |
| `components/mission-control/health-card.tsx` | Remove `border-l-4 ${border}` accent |
| `components/mission-control/cost-card.tsx` | Remove `border-l-4 border-l-violet-500` accent |
| `components/mission-control/up-next-card.tsx` | Remove `border-l-4 border-l-gray-400` accent |
| `components/mission-control/shipped-card.tsx` | Remove `border-l-4 border-l-green-600` accent |
| `components/mission-control/controls-card.test.tsx` | Verify no snapshot breakage |
| `components/mission-control/working-on-card.test.tsx` | Verify no snapshot breakage |
| `components/mission-control/shipped-card.test.tsx` | Verify no snapshot breakage |

---

## 4. Sub-Tasks

### T1 — Grid layout restructure in `page.tsx` (S)

**File:** `app/project/[id]/page.tsx`

**Changes:**
- Replace the current `grid grid-cols-1 md:grid-cols-2 gap-4` wrapper with a 3-column grid (`grid-cols-1 md:grid-cols-3 gap-5`).
- **Row 1:** WorkingOn spans 2 cols (`md:col-span-2`), Controls spans 1 col (`md:col-span-1`).
- **Row 2:** Questions spans 3 cols (`md:col-span-3`) — always rendered, full width. When no pending questions it renders its own empty state (already does this).
- **Row 2.5 section label:** `<p className="md:col-span-3 ...">Backlog</p>` (hidden on mobile with `hidden md:block`).
- **Row 3:** UpNext spans 1-2 cols (`md:col-span-2`), ShippedCard spans 1 col (`md:col-span-1`).
  - UpNext gets slightly more space since it lists upcoming items; Shipped is denser text.
  - Or keep 1.5/1.5 (col-span-1 each in a separate inner grid). Decision: keep them equal at `md:col-span-1` each (total 2 col), with Shipped taking the remaining 1 col via a nested pattern — simplest is both at `md:col-span-1` but that leaves a gap. **Revised:** Use a 2-col subgrid or just put them together as a pair using `md:col-span-3` and an inner 2-col grid.
  - Simplest reliable approach: keep outer grid 3-col and give UpNext `md:col-span-2`, ShippedCard `md:col-span-1`. Or UpNext `md:col-span-1`, Shipped `md:col-span-2` (shipped has longer summaries). Decision: UpNext `md:col-span-1`, Shipped `md:col-span-2` (summaries need room).
- **Row 3.5 section label:** `<p className="md:col-span-3 ...">Telemetry</p>`.
- **Row 4:** Health spans `md:col-span-1`, Cost spans `md:col-span-2` (cost has more text content — session + total + sub-caption).
- Update bottom padding: `pb-8` → `pb-12`.

**Exact className changes to `page.tsx` line 119:**
```
Before:  <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
After:   <main className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
```

**Grid wrapper line 136:**
```
Before:  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
After:   <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
```

**WorkingOn card — add col-span:**
```
Before:  <WorkingOnCard state={...} ... />
After:   <div className="md:col-span-2"><WorkingOnCard ... /></div>
```

**ControlsCard — no col-span change** (stays 1 col, but now positioned last in this row via order — it's rendered after WorkingOn already, no reorder needed if markup order matches visual order):

**Note on render order:** Current markup order is: WorkingOn, Health, CostCard, QuestionsCard, UpNext, ShippedCard, ControlsCard. New visual order should be: WorkingOn, Controls, Questions, UpNext, Shipped, Health, Cost. We need to reorder the JSX to match grid visual order:

New JSX order:
1. WorkingOn (`md:col-span-2`)
2. ControlsCard (`md:col-span-1`)
3. QuestionsCard (`md:col-span-3`)
4. Section label "Backlog" (`md:col-span-3 hidden md:block`)
5. ShippedCard (`md:col-span-2`)
6. UpNextCard (`md:col-span-1`)
7. Section label "Telemetry" (`md:col-span-3 hidden md:block`)
8. CostCard (`md:col-span-2`)
9. HealthCard (`md:col-span-1`)

**Dependencies:** None  
**Agent type:** Dev (sonnet)  
**Test strategy:** Unit tests for cards are pure logic (no layout assertions) — no breakage expected. Run `npx vitest run` to confirm.  
**Acceptance criteria:**
- On desktop: WorkingOn is 2/3 width, Controls is 1/3 width, both on row 1.
- Questions spans full width on row 2 (regardless of pending state).
- Shipped and UpNext are adjacent on row 3.
- Health and Cost are adjacent on row 4.
- All cards are still rendered (no functionality removed).
- `npx vitest run` passes.
**Status:** pending

---

### T2 — Remove border-l-4 from secondary cards (S)

**Files:** `health-card.tsx`, `cost-card.tsx`, `up-next-card.tsx`, `shipped-card.tsx`

**Exact className changes:**

`health-card.tsx` line 43:
```
Before:  <div className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 ${border} rounded-lg p-5`}>
After:   <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
```
(Remove `border-l-4 ${border}` — the `border` variable came from `deriveHealth()` to set `border-l-{color}`. Since we remove the colored accent, the `border` return value and `deriveHealth()` function are no longer needed for card styling. Keep the `color` text class used on the health label itself — only remove the border styling.)

`cost-card.tsx` line 65:
```
Before:  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-violet-500 rounded-lg p-5">
After:   <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
```

`up-next-card.tsx` line 24:
```
Before:  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-gray-400 dark:border-l-zinc-600 rounded-lg p-5">
After:   <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
```

`shipped-card.tsx` line 30:
```
Before:  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-green-600 rounded-lg p-5">
After:   <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
```

**Note on `health-card.tsx`:** The `deriveHealth` function returns `border` string. After this change, that field is unused. Remove the `border` field from the return type and destructuring, or leave it (harmless). Recommended: remove it for cleanliness. The `label`, `reason`, and `color` fields are still used.

**Dependencies:** None (independent of T1)  
**Agent type:** Dev (sonnet)  
**Test strategy:** `npx vitest run` — no layout/className assertions in existing tests.  
**Acceptance criteria:**
- HealthCard, CostCard, UpNextCard, ShippedCard have no colored left border.
- WorkingOnCard still has green/red `border-l-4`.
- QuestionsCard still has red `border-l-4` when questions pending.
- ControlsCard still has amber `border-l-4` when stalled.
- `npx vitest run` passes.
**Status:** pending

---

### T3 — Typography and spacing improvements (S)

**Files:** `working-on-card.tsx`, `app/project/[id]/layout.tsx`

**working-on-card.tsx — task title prominence:**

Line 99 (the active task title `<p>` element):
```
Before:  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 leading-snug">
After:   <p className="text-base font-medium text-gray-900 dark:text-zinc-100 leading-snug">
```

**app/project/[id]/layout.tsx — running status badge inline with project name:**

Current: status dot is in a separate right-aligned `div` at `mt-1`.

Change: remove the separate status div. Add a status indicator inline with the `h1`, as a small colored ring/dot preceding it, or a small badge beneath the project name.

Proposed: place the running indicator as a small pill badge next to the project name inside the header div, between the name and the path:

```tsx
// Remove the right-aligned status div entirely (lines 72–80)
// Add beneath the h1 (after the path line):
<div className="flex items-center gap-2 mt-1">
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
      running
        ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
        : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500"
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-gray-400 dark:bg-zinc-600"}`} />
    {running ? "Running" : "Stopped"}
  </span>
</div>
```

This keeps the status co-located with the project name and frees the top-right corner for future use (e.g., quick access buttons or breadcrumbs).

**Dependencies:** T1 should ideally land first for layout context, but T3 is independently mergeable.  
**Agent type:** Dev (sonnet)  
**Test strategy:** Visual inspection only — no unit tests assert layout typography.  
**Acceptance criteria:**
- Active task title in WorkingOn card is visibly larger than supporting text.
- Running/Stopped pill badge appears inline with the project name area (below h1 or adjacent).
- No right-aligned status div in the layout header.
- Both light and dark mode look correct.
- `npx vitest run` passes.
**Status:** pending

---

### T4 — Test suite verification (S)

**Files:** All test files in `components/mission-control/*.test.tsx`

After T1-T3 are applied, run the full test suite. If any existing tests reference className strings that were changed (unlikely since existing tests check text content and behavior, not layout classes), update them.

**Also:** Add a basic render test for the updated `health-card.tsx` if the `border` field removal from `deriveHealth()` changes the function signature. Existing tests for health-card currently test the `deriveHealth` function indirectly — confirm none rely on the `border` return value.

**Dependencies:** T1, T2, T3  
**Agent type:** Dev (sonnet)  
**Test strategy:** `npx vitest run` — all 453 tests must pass.  
**Acceptance criteria:**
- `npx vitest run` passes with no failures.
- No test references a removed className or border variable.
**Status:** pending

---

## 5. Acceptance Criteria (Feature Level)

1. On desktop (≥768px), the mission control page shows a 3-column grid with WorkingOn + Controls in row 1.
2. Controls card is immediately visible without scrolling on a standard 1080p screen.
3. Questions card always spans full width; it is visible before the backlog/telemetry rows.
4. Secondary cards (Health, Cost, UpNext, Shipped) have no colored left border — only status cards (WorkingOn, Controls-stalled, Questions-pending) retain the `border-l-4` accent.
5. Active task title in WorkingOnCard is `text-base` (not `text-sm`).
6. Running status is shown as a pill badge co-located with the project name (not isolated top-right).
7. No existing functionality is removed — all cards, buttons, and dialogs continue to work.
8. `npx vitest run` passes (453/453 or current count).
9. Build passes: `NODE_ENV=production npm run build`.
10. Playwright visual verification confirms the layout renders correctly in both light and dark mode.

---

## 6. Out of Scope

- Backlog page, Live tab, History tab — not touched.
- Home page project cards — not touched.
- Component logic, API routes, data fetching — not touched.
- Mobile layout below 768px — single column layout is unchanged (grid is `grid-cols-1` on mobile, all cards stack naturally).
- Adding new cards or new information — this is polish, not new features.

---

## 7. Questions Posted

No questions for this spec — all design decisions are within engineering judgment per CEO request.
