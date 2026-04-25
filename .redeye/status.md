# BUILD Status — BL-067 Mission Control Redesign

**Iteration:** 103
**Phase:** BUILD complete → REVIEW
**Backlog item:** BL-067 — Redesign mission control page layout and cards

## Summary

All 3 sub-tasks shipped. Asymmetric 2-column command layout in place; right rail is fixed 300px and mission feed dominates the left. WorkingOn now reads as a hero, Questions collapses to a quiet strip when empty, Controls/Cost are tightened for the rail.

## Sub-tasks (all done)

- **T1:** Restructured `app/project/[id]/page.tsx` — `grid lg:grid-cols-[1fr_300px]`, removed Backlog/Telemetry labels and the nested `md:col-span-3` wrapper. Left column = WorkingOn + Questions + (Shipped/UpNext sub-grid). Right rail = Controls + Cost + Health.
- **T2:** Card updates:
  - WorkingOnCard: `p-6`, `min-h-[160px]`, `text-lg font-semibold` task title, `bg-green-50/30 dark:bg-green-950/10` wash when running.
  - QuestionsCard: collapses to compact strip (`px-4 py-2.5 rounded-md`) with no eyebrow when no pending questions; full red-tinted card unchanged when pending.
  - ControlsCard: `p-5` to `p-4`; `border-t border-gray-100 dark:border-zinc-800 pt-3 mt-1` separator between stop/pause row and steer/add-backlog row.
  - CostCard: Session/Total stacked vertically with `justify-between` rows; sparkline stays full-width below.
- **T3:** Test + build verification.

## Tests

- **773/773 passing** (was 762; +11 net).
- New tests:
  - WorkingOnCard hero (4): p-6/min-h verification, green wash on/off, hero typography.
  - QuestionsCard (5): empty strip, no red-border when empty, treats answered as empty, full-card pending, count badge.
  - ControlsCard (2): p-4 padding, border-t separator on second row.
- Updated tests: 3 cost-card assertions now match `Session`/`Total` labels (was `this session`/`total`).

## Files modified

- `/Users/casa/ControlTower/app/project/[id]/page.tsx`
- `/Users/casa/ControlTower/components/mission-control/working-on-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/questions-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/controls-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/cost-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/working-on-card.test.tsx`
- `/Users/casa/ControlTower/components/mission-control/questions-card.test.tsx` (new)
- `/Users/casa/ControlTower/components/mission-control/controls-card.test.tsx`
- `/Users/casa/ControlTower/components/mission-control/cost-card.test.tsx`
- `/Users/casa/ControlTower/docs/specs/BL-067-mission-control-redesign.md`

## Build

`npm run build` — clean (Next.js 16, Turbopack).

## Commits

- `feat: BL-067 T1 — asymmetric mission control grid`
- `feat: BL-067 T2 — WorkingOn hero, Questions strip, Controls/Cost rail`
- `redeye: build BL-067 complete — ready for review` (final state bump)

## Concerns / notes

- E2E (Playwright) not run — App URL configured (`http://localhost:3200`) but harness has no e2e command; defer to DEPLOY/VERIFY.
- No pre-existing issues encountered.
- Right rail width (300px) is tight — verified CostCard layout adapts (stacked rows). HealthCard untouched per spec; if it overflows on the rail, that is a follow-up, not in scope.
