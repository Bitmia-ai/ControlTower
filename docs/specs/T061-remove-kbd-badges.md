# BL-061: Remove keyboard shortcut badges from navigation buttons

## Goal

Remove the `<kbd>` shortcut hint badges (GB, GH, GL, GS, S, X, P, B) that appear
on nav tabs and action buttons. The CEO finds them distracting and wants them gone
from all buttons and links across the UI.

## Scope

### Files to change

1. `components/project-nav.tsx`
   - Remove `kbd` field from `NAV_ITEMS` entries (or remove the field entirely)
   - Remove `kbdCls` constant
   - Remove the `{kbd && <kbd aria-hidden="true">...</kbd>}` rendering block

2. `components/mission-control/controls-card.tsx`
   - Remove `kbdCls` constant
   - Remove the four `<kbd>` elements (S, X, P, B) from button labels

3. `components/project-nav.test.tsx`
   - Remove the test "renders GS kbd hint on Schedules tab" (now obsolete)
   - Ensure remaining tests still pass

4. `components/mission-control/controls-card.test.tsx` (if exists)
   - Remove any kbd-related assertions

## Sub-tasks

- T1: Edit `project-nav.tsx` — remove kbd fields, kbdCls, and <kbd> rendering
- T2: Edit `controls-card.tsx` — remove kbdCls and all <kbd> elements
- T3: Edit `project-nav.test.tsx` — remove GS kbd test
- T4: Check controls-card tests for kbd assertions and update
- T5: Run all tests (expect 662 → ~661 or same if controls-card test removed too)
- T6: Verify npm run build passes

## Acceptance criteria

- No `<kbd>` elements visible in the nav bar or controls card
- All remaining unit tests pass
- Build clean
