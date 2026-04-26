# BL-017: Cost card leaves empty column in mission control grid

**Type:** bug
**Priority:** P2
**Status:** done
**Iteration:** 35
**Spec author:** VP Engineering

---

## Problem Statement

In the mission control grid (`app/project/[id]/page.tsx`), cards are laid out in a
`grid-cols-1 md:grid-cols-2` 2-column grid. `CostCard` currently occupies one cell
(left column), while `QuestionsCard` conditionally spans `md:col-span-2` only when
there are pending questions. When there are no pending questions, `QuestionsCard`
sits in the right column — leaving Cost alone in the left. This produces a blank half-
row gap that looks unpolished.

Current card order:
```
WorkingOnCard  |  HealthCard
CostCard       |  [QuestionsCard — 1 col when no questions]
UpNextCard     |  ShippedCard
ControlsCard   |  [empty]
```

When questions exist, `QuestionsCard` spans full width, pushing `CostCard` alone
in its row. Either way, `CostCard` is never paired symmetrically.

---

## Architecture Decisions

**AD-1: Make CostCard always span full width (`md:col-span-2`).**
The cost card is informational and benefits from horizontal space to display the
"This session: $X.XX · Total: $XX.XX" layout without truncation. Full-width removes
the orphan-column issue entirely and mirrors how `QuestionsCard` handles full-width
scenarios. This is the minimal change (1 class addition).

**AD-2: Keep QuestionsCard span logic unchanged.**
`QuestionsCard` already handles its own span logic based on pending questions. Do
not change it.

**AD-3: No layout restructuring — single JSX class change.**
The fix is one added `md:col-span-2` wrapper class on the `CostCard` element in
`page.tsx`. No component internals change. No new files.

**AD-4: Update CostCard internals to use horizontal space.**
When spanning full width, the cost card should use the extra space. Update
`components/mission-control/cost-card.tsx` to display session and total side-by-side
in a horizontal layout (flex row) rather than stacked, taking advantage of the wider
container.

---

## Sub-tasks

### T1 — Add md:col-span-2 to CostCard wrapper in page.tsx

| Field | Value |
|-------|-------|
| **File** | `app/project/[id]/page.tsx` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | none |
| **Status** | done |

**Change:** Wrap `<CostCard>` in a `<div className="md:col-span-2">` (or add
`col-span-2` directly if the component accepts a className prop). The simplest
approach: wrap with a div.

Before:
```tsx
<CostCard projectId={projectId} running={running} />
```

After:
```tsx
<div className="md:col-span-2">
  <CostCard projectId={projectId} running={running} />
</div>
```

**Acceptance criteria:**
- `CostCard` spans two columns on `md:` breakpoint and above.
- No other cards are repositioned.
- `npm run build` passes.

---

### T2 — Update CostCard internals for horizontal layout

| Field | Value |
|-------|-------|
| **File** | `components/mission-control/cost-card.tsx` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1 |
| **Status** | done |

**Description:**
Read the current `cost-card.tsx` layout. If session and total costs are stacked
vertically (flex-col), change to display them side by side (flex-row with a
divider or gap) to use the wider space. Maintain the existing label/value
typography. Do not change the fetch logic, polling interval, or error state.

**Acceptance criteria:**
- Session cost and total cost render side-by-side on wide screens.
- Loading and error states still render correctly.
- No TypeScript errors.
- `npm run build` passes.

---

### T3 — Verify build and visual correctness

| Field | Value |
|-------|-------|
| **File** | n/a |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1, T2 |
| **Status** | done |

**Description:**
Run `npm run build` and confirm zero errors. Optionally take a Playwright
screenshot of `/project/0` with mocked APIs to confirm CostCard spans the
full width without blank columns.

**Acceptance criteria:**
- `npm run build` exits 0.
- No orphan blank column in the mission control grid.

---

## Files to Change

| File | Change type |
|------|-------------|
| `app/project/[id]/page.tsx` | Wrap CostCard in `md:col-span-2` div |
| `components/mission-control/cost-card.tsx` | Switch to horizontal flex layout |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CostCard content truncates at narrow viewport | Low | Use `flex-wrap` or keep stacked on mobile |
| Other cards shift unexpectedly | Low | Only wrapping CostCard; grid flow is unchanged |
| CostCard has fixed width assumption | Low | Read component before editing; remove any `w-` constraints |
