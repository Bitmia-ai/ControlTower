# BL-062 — Fix Inconsistent Card Sizes on Mission Control

**Status:** planned  
**Priority:** P1  
**Spec author:** VP Engineering (iter 92)

---

## 1. Problem Statement

The mission control page at `/project/[id]` renders 7 cards in a 3-column CSS Grid
(post BL-045 redesign). The cards have **content-driven heights** and the grid
default stretches each cell to the row's tallest item. This produces visually
inconsistent card heights in every paired row:

| Row | Left card | Right card | Typical mismatch |
|-----|-----------|------------|-----------------|
| 1   | WorkingOnCard (2/3) | ControlsCard (1/3) | WorkingOn is very short (1-3 lines) in idle/simple state; Controls is taller when running (2 button rows + caption) |
| 3   | ShippedCard (2/3) | UpNextCard (1/3) | ShippedCard can show 5 items with summaries; UpNextCard shows 3 shorter items |
| 4   | CostCard (2/3) | HealthCard (1/3) | CostCard grows tall when sparkline is present; HealthCard is 3 lines |

The result: the shorter card in each row has a large blank void at the bottom.
This looks unfinished and "messy" — the CEO's exact description.

Additional problem in the `WorkingOnCard`: the card body has almost no content
in idle state (one line: "RedEye is idle"), so the row-1 WorkingOn/Controls pair
is extremely shallow, wasting vertical space and looking inconsistent relative to
the other rows.

---

## 2. Architecture Decisions

### 2.1 Grid alignment strategy: `items-start`

Add `items-start` to the grid container so cards in a row sit flush to the top
of their cell and size to their own content. Cards are no longer stretched to
match the tallest sibling. This is the primary fix — it eliminates all the
blank-bottom voids.

**Tradeoff:** Paired cards no longer share height. This is acceptable because
each card is self-contained and equal-height adds no information. The designer
sub-agent review confirms this is the right call for a data dashboard.

### 2.2 Row-1 minimum height for WorkingOnCard

Without stretch, `WorkingOnCard` in idle state collapses to ~80px. `ControlsCard`
in running state is ~150px. They sit at different heights in the same visual row,
which looks mismatched even without stretching.

Fix: apply `min-h-[120px]` to both the WorkingOnCard and ControlsCard wrapper
divs. This ensures the row-1 pair always has at least a consistent minimum floor.
`120px` is enough to comfortably fit the idle WorkingOn content and matches the
compressed Controls card in stopped state (Start button only, no caption).

### 2.3 Sparkline `preserveAspectRatio`

The SVG sparkline in `CostCard` uses `preserveAspectRatio="none"` with
`width="100%"` and `height={48}` (fixed). On a 2/3-wide card (typically ~500px),
the `viewBox="0 0 200 48"` is stretched horizontally 2.5x while height stays
fixed at 48px. This makes the chart look like a squashed/stretched image — a
separate but related visual quality issue.

Fix: replace `preserveAspectRatio="none"` with `preserveAspectRatio="xMidYMid meet"`
and set `height` to auto (remove the fixed `height={48}`, let SVG scale from
viewBox). Wrap the SVG container in a `max-h-[60px]` div to cap growth. The chart
will then render proportionally on any width.

### 2.4 No new dependencies

All fixes are pure Tailwind class changes and a one-attribute SVG change. No new
packages needed.

### 2.5 Mobile behaviour unchanged

The grid is `grid-cols-1` on mobile — all cards stack single-column and this
change has no effect on that path.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `app/project/[id]/page.tsx` | Add `items-start` to grid; add `min-h-[120px]` wrappers for row-1 cards |
| `components/mission-control/sparkline-chart.tsx` | Fix `preserveAspectRatio`; remove fixed `height` attr |
| `components/mission-control/cost-card.tsx` | Add `max-h` wrapper around sparkline |
| `components/mission-control/sparkline-chart.test.tsx` | Update snapshot / prop assertions if needed |

---

## 4. Sub-Tasks

### T1 — Add `items-start` to grid + min-height for row-1 pair (S)

**File:** `app/project/[id]/page.tsx`

**Change 1 — grid wrapper:** Add `items-start` to the grid `className`:

```
Before:  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
After:   <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:items-start">
```

`md:items-start` scopes the change to tablet/desktop only (the breakpoint where
columns actually appear).

**Change 2 — WorkingOn wrapper:** Add `min-h-[120px]`:

```
Before:  <div className="md:col-span-2">
After:   <div className="md:col-span-2 md:min-h-[120px]">
```

**Change 3 — Controls wrapper:** Add matching `min-h-[120px]`:

```
Before:  <div className="md:col-span-1">
After:   <div className="md:col-span-1 md:min-h-[120px]">
```

The WorkingOnCard and ControlsCard already fill 100% of their wrapper div
(`rounded-lg p-5` without explicit height), so they will each fill their
min-height wrapper naturally.

**Dependencies:** None  
**Assigned agent:** Dev (sonnet)  
**Test strategy:** `npx vitest run` — no layout assertions in existing tests, all should pass.  
**Acceptance criteria:**
- On desktop, row 1 (WorkingOn + Controls) both have at least 120px height.
- Shorter cards in rows 3 and 4 no longer stretch to match their taller sibling.
- `npx vitest run` passes.  
**Status:** done

---

### T2 — Fix sparkline SVG proportions (S)

**File:** `components/mission-control/sparkline-chart.tsx`

**Problem:** `preserveAspectRatio="none"` + fixed `height={48}` + `width="100%"` causes
the 200×48 viewBox to stretch to fill whatever container width the card gives,
making the chart look squashed horizontally. On a 500px-wide card the effective
scale is ~2.5x horizontal, 1x vertical.

**Change:** Remove the fixed `height` attribute and change `preserveAspectRatio`:

```
Before:
  <svg
    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
    width="100%"
    height={VIEW_H}
    preserveAspectRatio="none"
    ...
  >

After:
  <svg
    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
    width="100%"
    preserveAspectRatio="xMidYMid meet"
    ...
  >
```

With `meet` + `width="100%"` and no fixed height, the SVG will maintain its
4.17:1 aspect ratio (200:48). On a 500px wide container it will render 500×120px,
which is proportional and readable. The `max-h` cap on the container (T3) limits
growth.

**Note on date labels:** The date labels at `y={VIEW_H - 2}` = y=46 still work
correctly in the proportional render — they stay near the bottom of the viewBox.

**Dependencies:** Should land alongside T3.  
**Assigned agent:** Dev (sonnet)  
**Test strategy:** Update `sparkline-chart.test.tsx` if it asserts `preserveAspectRatio` or `height` attribute values.  
**Acceptance criteria:**
- Sparkline no longer appears horizontally stretched on wide cards.
- `data-testid="sparkline"` element has no `height` attribute (or height is omitted).
- `preserveAspectRatio` is `xMidYMid meet`.
- `npx vitest run` passes.  
**Status:** done

---

### T3 — Cap sparkline height in CostCard (S)

**File:** `components/mission-control/cost-card.tsx`

With T2 making the sparkline proportionally tall on wide cards, we need a max-height
cap to prevent the Cost card from becoming excessively tall.

**Change:** Wrap the `<SparklineChart>` render in a `max-h` div:

Current code (in CostCard):
```tsx
<div className="text-red-500 dark:text-red-400">
  <SparklineChart sessions={sessions} />
</div>
```

After:
```tsx
<div className="text-red-500 dark:text-red-400 max-h-[72px] overflow-hidden">
  <SparklineChart sessions={sessions} />
</div>
```

`72px` is generous enough to show all the sparkline content (bars + date labels)
while capping runaway growth. At a 500px-wide card with `preserveAspectRatio="meet"`,
the proportional height would be ~120px — this cap limits it to 72px, which still
renders cleanly.

**Dependencies:** T2 (the proportional SVG must exist first for this cap to be meaningful).  
**Assigned agent:** Dev (sonnet)  
**Test strategy:** `npx vitest run` — wrapper div change only, no logic touched.  
**Acceptance criteria:**
- Sparkline container height never exceeds 72px in the DOM.
- `npx vitest run` passes.  
**Status:** done

---

### T4 — Ensure internal card fill (S)

Each card component wraps its content in a `div` with `p-5`. With `items-start`, the
card div is sized by its content. We need to confirm that no card shows partial/floating
content when its wrapper is exactly min-height.

**Audit each card:**

- `WorkingOnCard`: `p-5` padded block. Has `space-y-3` content. No fixed heights. OK.
- `ControlsCard`: `p-5` + `flex flex-col gap-3` layout. Fills naturally. OK.
- `QuestionsCard`: full-width, single column. Unaffected by `items-start`. OK.
- `ShippedCard`: list items. Sizes to content. OK.
- `UpNextCard`: list items. Sizes to content. OK.
- `CostCard`: stat + sparkline. Sizes to content (sparkline now capped). OK.
- `HealthCard`: 3 stat lines. Sizes to content. OK.

No changes needed to card internals — this task is a verification/audit pass only.

If audit reveals any card with a visible content-overflow or awkward clip at the
min-height boundary, the developer must add `flex flex-col justify-between` inside
that card's root div and add a suitable minimum content block.

**Dependencies:** T1, T2, T3  
**Assigned agent:** Dev (sonnet)  
**Test strategy:** Playwright screenshot verification at 1280×800 and 1440×900 viewport in both light and dark mode.  
**Acceptance criteria:**
- No card has blank voids or clipped content.
- All 7 cards render visually clean at standard desktop viewports.
- `npx vitest run` passes.  
**Status:** pending

---

### T5 — Test suite and build verification (S)

Run the full test suite and production build after T1–T4 are merged.

**Commands:**
```bash
npx vitest run
NODE_ENV=production npm run build
```

**Files that may need updates:**
- `components/mission-control/sparkline-chart.test.tsx` — if it asserts `height` or `preserveAspectRatio` attributes directly.
- Any snapshot tests referencing grid class strings.

**Dependencies:** T1, T2, T3, T4  
**Assigned agent:** Dev (sonnet)  
**Test strategy:** Full regression. All existing tests must pass.  
**Acceptance criteria:**
- `npx vitest run` reports 0 failures (currently 656 tests).
- `NODE_ENV=production npm run build` exits 0.  
**Status:** pending

---

## 5. Acceptance Criteria (Feature Level)

1. Cards in the same row are top-aligned, not stretched to equal height.
2. Row-1 (WorkingOn + Controls) has a consistent minimum height so neither card looks like a thin sliver.
3. The sparkline chart renders proportionally — not horizontally squashed.
4. No card shows blank void space at the bottom due to stretching.
5. All 7 cards are still present and functional.
6. `npx vitest run` passes (656/656).
7. `NODE_ENV=production npm run build` passes.

---

## 6. Questions Posted

No questions — all decisions are within engineering judgment. The fix is straightforward:
`items-start` + `min-h` floor + proportional SVG.
