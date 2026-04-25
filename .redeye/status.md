# BL-074 — Working On / Controls card height fix

**Updated:** 2026-04-25T22:15:00Z (iter 99 BUILD complete)
**Phase:** review
**Phase Status:** ready

## Summary
Fixed visible height mismatch between WorkingOnCard and ControlsCard on the
mission-control grid. Both cards already used `h-full`, but the outer grid
forced `md:items-start`, preventing row-stretch. Wrapped the two top cards in
a nested two-column grid (without `items-start`) so they stretch to the row
height defined by whichever is taller. Outer grid keeps `items-start` so
subsequent rows (Shipped/UpNext, Cost/Health) preserve top-aligned behaviour.

## Sub-tasks
- [done] T1: Restructure mission-control layout so WorkingOn + Controls share a stretching row.

## Files modified
- `/Users/casa/ControlTower/app/project/[id]/page.tsx` — nested grid for top row
- `/Users/casa/ControlTower/docs/specs/BL-074-card-height-fix.md` — spec
- `/Users/casa/ControlTower/.redeye/state.json` — phase + iteration log

## Tests written
None — pure CSS/layout change with no behavioural surface that vitest can
exercise (jsdom doesn't compute layout). Existing rendering tests for both
cards still pass and confirm no markup regressions.

## Verification
- `npx vitest run` — 691/691 pass
- `npm run build` — clean (Next.js 16 / Turbopack)

## Concerns
None. Visual confirmation should happen during VERIFY via browser snapshot.
