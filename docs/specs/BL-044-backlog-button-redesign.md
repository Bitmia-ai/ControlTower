# BL-044 — Backlog Button Redesign

**Status:** pending  
**Priority:** P1  
**Type:** feature  
**Iteration planned:** 58

---

## Problem Statement

The Controls card on the project mission control page (`/project/[id]`) contains two secondary action buttons: "Steer" and "+ Backlog". The "+ Backlog" label is terse and unclear — it reads like a tag or label rather than an action. The button needs a label that communicates intent ("add something to the backlog") and a visual treatment that makes it stand out as the primary action for queueing new work.

---

## Current State

**File:** `components/mission-control/controls-card.tsx` (lines 232–245)

```
<div className="flex gap-2">
  <button
    onClick={onSteer}
    className="flex-1 px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-md border border-gray-200 dark:border-zinc-700 transition"
  >
    Steer
  </button>
  <button
    onClick={onAddBacklog}
    className="flex-1 px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-md border border-gray-200 dark:border-zinc-700 transition"
  >
    + Backlog
  </button>
</div>
```

Issues:
- Label "+ Backlog" is ambiguous — "Backlog" is a noun, not a verb. It doesn't communicate "add an item."
- Both buttons share identical styling, making neither feel more important than the other.
- The button has no `aria-label`, so its purpose is opaque to screen readers.
- No icon to visually reinforce intent.

---

## Proposed Changes

### T1 — Update button label, icon, and styling

**New label:** "Add to Backlog"

**Rationale:** The dialog title is already "Add to Backlog" (see `components/add-backlog-dialog.tsx` line 64). Using the same phrase on the trigger button creates a natural, consistent mental model. It is an explicit verb phrase that communicates the action.

**Visual treatment:** Give the "Add to Backlog" button a subtle accent (indigo/violet tint) to differentiate it from the neutral "Steer" button, while keeping it secondary to the primary Start/Stop/Pause row. Use a `PlusCircle` icon from `lucide-react` (already a project dependency via other card components).

Proposed classes for the button:
```
flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium
bg-indigo-50 dark:bg-indigo-950/40
hover:bg-indigo-100 dark:hover:bg-indigo-900/50
text-indigo-700 dark:text-indigo-300
rounded-md border border-indigo-200 dark:border-indigo-800
transition
```

**Icon:** `<PlusCircle size={14} />` prepended inside the button, using `inline-flex items-center gap-1.5` layout.

**aria-label:** `"Add item to backlog"` — distinct from the button text so screen readers get a slightly more explicit label.

The "Steer" button retains its current neutral styling unchanged.

**Summary of prop/structure changes:**
- No new props, no new components.
- `PlusCircle` imported from `lucide-react`.
- Button text changes from `+ Backlog` to `Add to Backlog`.
- Classes updated as above.
- `aria-label="Add item to backlog"` added.

### T2 — Update unit test to match new button text

**File:** `components/mission-control/controls-card.test.tsx`

The existing test suite does not directly query for the "+ Backlog" button text, but two lines of caution:
1. No test currently asserts `+ Backlog` as a role query — verified by inspection. The test file has no reference to "Backlog" at all.
2. A new test should confirm the button renders with the new accessible name so this never silently regresses.

Add one test case:
```ts
it("renders Add to Backlog button with correct accessible label", () => {
  const onAddBacklog = vi.fn();
  render(<ControlsCard running={false} onAddBacklog={onAddBacklog} />);
  const btn = screen.getByRole("button", { name: /Add item to backlog/i });
  expect(btn).toBeTruthy();
  fireEvent.click(btn);
  expect(onAddBacklog).toHaveBeenCalledTimes(1);
});
```

---

## Architecture Decisions

1. **No new component.** The change is entirely within `ControlsCard`. The button is already rendered inline; no abstraction is needed for a single-instance button.
2. **Lucide icon.** `lucide-react` is already imported in `ControlsCard` (`ChevronDown`). Adding `PlusCircle` is a zero-cost import addition.
3. **Indigo accent, not red.** Red is the project accent for destructive/primary actions (Start uses green; Stop uses red). Using indigo for "Add to Backlog" positions it clearly as a secondary creative action without conflicting with the power controls.
4. **Steer button unchanged.** Only the backlog button is in scope; keeping Steer neutral avoids an unrequested redesign of that action.
5. **No API, route, or state changes.** The button is purely cosmetic — it still calls `onAddBacklog()` which opens the same `AddBacklogDialog`.

---

## Sub-Tasks

| ID | Description | Size | Depends On | Agent Type | Test Strategy | AC | Status |
|----|-------------|------|------------|------------|---------------|-----|--------|
| T1 | Update button in `controls-card.tsx`: label → "Add to Backlog", add `PlusCircle` icon, apply indigo accent classes, add `aria-label` | S | — | Dev (generic) | Render visually via Playwright screenshot; unit test added in T2 | Button reads "Add to Backlog", has icon, has indigo styling, has aria-label, clicks still open dialog | done |
| T2 | Add unit test in `controls-card.test.tsx` asserting new accessible name and click handler | S | T1 | Dev (generic) | `npx vitest run` passes with new test case | Test queries `{ name: /Add item to backlog/i }`, asserts click fires `onAddBacklog` | done |

---

## Files Touched

| File | Change |
|------|--------|
| `components/mission-control/controls-card.tsx` | Add `PlusCircle` import; update button label, classes, aria-label |
| `components/mission-control/controls-card.test.tsx` | Add one new test case for new accessible name |

## Files NOT Touched

| File | Reason |
|------|--------|
| `app/project/[id]/page.tsx` | Button trigger wiring (`onAddBacklog`) unchanged |
| `components/add-backlog-dialog.tsx` | Dialog content unchanged |
| `app/api/projects/[id]/backlog/route.ts` | No API changes |
| Any other component | Scope is isolated to ControlsCard |

---

## Acceptance Criteria

1. The Controls card on the project mission control page shows "Add to Backlog" (not "+ Backlog") on the button.
2. A `PlusCircle` icon appears to the left of the button label.
3. The button has an indigo tint in both light and dark mode (distinguishable from the neutral "Steer" button).
4. The button's `aria-label` is `"Add item to backlog"`.
5. Clicking the button opens the "Add to Backlog" dialog (existing behavior preserved).
6. `npx vitest run` passes with the new test case included.
7. Playwright screenshot confirms correct rendering in both light and dark mode.
8. No other Controls card functionality is affected (Stop, Pause, Steer, Force Stop).
