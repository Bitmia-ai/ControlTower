# T074 — Working On / Controls card height alignment

## Problem
On the mission-control grid, the `WorkingOnCard` and `ControlsCard` sit side by side
in the first row. Both card root divs already use `h-full`, but the parent grid
sets `md:items-start`, which forces every grid item to align to the top of its
row at its intrinsic height instead of stretching to the row height. As a
result the shorter Controls card stops at its natural height while Working On
extends below it, producing a visible mismatch.

## Fix
Wrap WorkingOn + Controls in a contained two-column row that uses
`items-stretch` (the default), and keep `md:items-start` on the outer grid so
later rows (Shipped/UpNext, Cost/Health) keep their current top-aligned
behaviour. The inner two-column row's grid cells stretch by default, so both
cards will share the row height defined by whichever is taller. Both card
roots already have `h-full`, so they will fill the cell.

Concretely: lift the two top cards out of the outer grid and put them in a
sibling `div` with `grid grid-cols-1 md:grid-cols-3 gap-5` (no `items-start`)
that lives directly above the rest of the grid. The `min-h-[120px]` on the
wrappers is preserved.

## Sub-tasks
- [done] T1: Restructure mission-control layout so WorkingOn + Controls share a stretching row, then verify with vitest + build.

## Verification
- `npx vitest run` — all 691 tests pass.
- `npm run build` — clean.
- Visual check (manual / E2E later): cards align at their bottom edges on `md+`.
