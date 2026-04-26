# BL-064 — Cost Plot Scaling Fix

**Status:** planned  
**Priority:** P1  
**Type:** bug-fix  
**Iteration:** 93  

## Problem

The cost sparkline in the mission-control Cost card looks stretched: very wide but not tall. The CEO reports it "feels like a stretched image."

**Root cause:** The SVG `viewBox` is `0 0 200 48` (4.17:1 ratio). With `width="100%"` the SVG fills the full card width (may be 400–600px), making the chart ~96–144px tall before the `max-h-[72px] overflow-hidden` container clips it. Even with `preserveAspectRatio="xMidYMid meet"`, at full card width the chart appears very wide and short — the text labels and lines are visually stretched horizontally because the viewBox itself is a wide rectangle.

## Fix

**T1 — Improve viewBox proportions and container sizing** (S)

In `components/mission-control/sparkline-chart.tsx`:
- Change `VIEW_H` from `48` to `80` (better 2.5:1 ratio, less squished)
- Change `PADDING_BOTTOM` from `14` to `18` to give date labels more breathing room
- Remove `width="100%"` from the SVG element; instead set `height="80"` and let width be auto
- This makes the SVG render at its natural height (80px) and scale width proportionally — no more stretching

In `components/mission-control/cost-card.tsx`:
- Remove `max-h-[72px] overflow-hidden` from the sparkline container div
- Replace with `overflow-hidden rounded` (no height clip needed since SVG now has fixed height)

**T2 — Unit tests** (S)

In `components/mission-control/sparkline-chart.test.tsx`:
- Update snapshot / attribute assertions to reflect new VIEW_H=80
- Verify the SVG has `height="80"` attribute and no `width` attribute (or width is absent)
- Tests must pass: `npx vitest run`

## Sub-tasks

| ID | Description | Size |
|----|-------------|------|
| T1 | Fix viewBox proportions and SVG sizing | S |
| T2 | Update unit tests | S |

## Acceptance Criteria

1. Sparkline no longer looks stretched — has a natural 2.5:1 ratio
2. Chart height is fixed at 80px; width scales to available space without distortion
3. Date labels have sufficient vertical room  
4. No regression in dark/light mode
5. `npx vitest run` passes (all tests green)
6. `NODE_ENV=production npm run build` succeeds with no errors

## Files Touched

- `components/mission-control/sparkline-chart.tsx`
- `components/mission-control/cost-card.tsx`
- `components/mission-control/sparkline-chart.test.tsx`
