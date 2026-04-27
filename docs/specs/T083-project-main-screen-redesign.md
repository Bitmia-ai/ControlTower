# T083: Project Main Screen Redesign — Control Buttons Alignment + Icons

**Type:** feature  
**Priority:** P0  
**Status:** planned  
**Iteration:** 110  
**CEO Request:** "The 4 control buttons in the project main screen are misaligned. Also only one has an icon. Can we have the design subagent and front end skill fix the entire project main screen so it looks sleek and not messy?"

---

## Problem Statement

The ControlsCard in `components/mission-control/controls-card.tsx` has four action buttons:
1. **Start** (when idle) / **Stop + chevron dropdown** (when running) — has no icon
2. **Pause** (when running) / **Restart** (when stalled) — has no icon
3. **Steer** — has no icon
4. **Add Task** — has a PlusCircle icon (the only one with an icon)

Issues:
- Only "Add Task" has an icon — the other three buttons are text-only, creating visual inconsistency
- The two rows of buttons (primary row: Start/Stop/Pause, secondary row: Steer/Add Task) feel like separate unrelated sections
- `flex-wrap` layout can cause buttons to stack oddly at certain widths
- The overall Controls card looks more like a utility panel than a polished control surface
- The right rail (Controls + Cost + Health) generally looks functional but not sleek

---

## Design Direction

Apply the precision-instrument aesthetic already established across the dashboard (T066, T067, T071). The Controls card should feel like a command surface — each button has a clear icon, consistent sizing, and intentional visual weight.

### Button Icons (from lucide-react, already installed)

| Button | Icon | Visual Style |
|--------|------|--------------|
| Start | `Play` | green-700 bg, white text |
| Stop | `Square` | red-700 bg, white text |
| Pause | `Pause` | zinc-700/gray-200 bg, zinc-200/gray-700 text |
| Restart (stalled) | `RotateCcw` | amber-600 bg, white text |
| Steer | `Compass` (or `Navigation`) | ghost/outline, gray/zinc |
| Add Task | `PlusCircle` (keep existing) | indigo accent (keep existing) |

### Layout Fix

Replace the two `flex-wrap gap-2` rows with a consistent button grid:

**When idle:**
```
[ Start (full width, tall) ]
[ Steer ] [ Add Task ]
```

**When running:**
```
[ Stop (flex-1) ] [ ^ ] [ Pause (flex-1) ]
[ Steer ] [ Add Task ]
```

All buttons: `min-h-[44px]`, consistent `px-3 py-2 text-sm font-medium`, icons at `size={15}` with `gap-1.5`.

---

## Sub-tasks

### T1 (S): Add icons to all four primary buttons in ControlsCard
- Import `Play`, `Square`, `Pause`, `RotateCcw`, `Compass` from `lucide-react`
- Add icon to Start button: `<Play size={15} />` + "Start"
- Add icon to Stop button: `<Square size={15} />` + stop label
- Add icon to Pause button: `<Pause size={15} />` + pause label
- Add icon to Restart button: `<RotateCcw size={15} />` + "Restart"
- Add icon to Steer button: `<Navigation size={15} />` + "Steer"
- All buttons use `inline-flex items-center justify-center gap-1.5`
- Update `controls-card.test.tsx` — add assertions that icon+label renders for each button state

### T2 (S): Fix button layout alignment
- Remove `flex-wrap` from the primary button row — use `flex gap-2` with `flex-1` on each button
- Ensure Stop split-button (main + chevron) still works correctly within the flex row
- Ensure the secondary row (Steer + Add Task) is also `flex gap-2` with `flex-1` on each
- Verify no layout breakage at 300px width (the right rail column)
- Add a snapshot/classname test in `controls-card.test.tsx` for the layout structure

### T3 (S): Visual polish pass on the right rail cards
- **ControlsCard**: increase the gap slightly between primary/secondary rows (`gap-3` → keep, but ensure `pt-3 mt-1` separator row uses `mt-2` for breathing room)
- **CostCard**: the "Updates every 30s" / "Session ended" caption is `text-xs text-gray-400` — raise to `dark:text-zinc-500` (already correct, verify)
- **WorkingOnCard**: already hero treatment from T067 — no changes needed
- Any test file that asserts on button text (without icons) may need updating if the label structure changes (e.g. if button now contains both an SVG and text node, `.textContent` based assertions should still pass)

---

## Acceptance Criteria

1. All four action buttons (Start, Stop, Pause/Restart, Steer) have icons
2. Add Task already has an icon — keep it
3. No button wraps or overlaps at 300px container width
4. Light mode and dark mode both look correct
5. All existing `controls-card.test.tsx` tests pass (update assertions where needed)
6. Build is clean: `NODE_ENV=production npm run build` exits 0
7. Test suite passes (same 280 passing / 432 pre-existing failures as baseline)

---

## Files to Modify

- `components/mission-control/controls-card.tsx` — icons + layout
- `components/mission-control/controls-card.test.tsx` — update/add assertions

## Files to Leave Alone

- `mission-control-client.tsx` — layout unchanged
- `working-on-card.tsx` — no changes needed
- `cost-card.tsx` — no changes needed
- `health-card.tsx` — no changes needed
- `shipped-card.tsx` — no changes needed

---

## Test Plan

**T1:** controls-card renders Start with Play icon (check `aria-label` or button text includes "Start"); same for Stop, Pause, Steer.  
**T2:** Controls card layout — at various states (idle/running/stalled) the button count and structure is correct.  
**T3:** Build smoke — `NODE_ENV=production npm run build` clean.

Estimated new tests: ~4–6 (updating existing + adding icon presence checks).
