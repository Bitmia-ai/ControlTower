# MERGE Status — BL-062

**Date:** 2026-04-25
**Iteration:** 92 -> 93
**Phase:** MERGE complete -> TRIAGE

## Result

BL-062 (Fix inconsistent card sizes on main project screen) merged successfully. No worktree to merge — all work was committed directly to main throughout the TRIAGE/PLAN/BUILD/REVIEW/DEPLOY/VERIFY cycle.

## Commits Merged

All BL-062 work was on main. Key commits in this cycle:
- `feat: fix inconsistent card sizes — proportional sparkline + grid items-start (BL-062)`
- `feat: sparkline uses xMidYMid meet, no fixed height (BL-062 task 2)`
- `feat: cap sparkline container height at 72px in CostCard (BL-062 task 3)`
- `feat: h-full on row-1 cards to fill min-h wrapper (BL-062 task 4)`
- `feat: verify tests + prod build pass (BL-062 task 5)`
- `redeye: complete VERIFY BL-062 — PASS, 657/657 tests, build clean (iteration 92)`

## Files Changed (BL-062)

- `app/project/[id]/page.tsx` — grid `md:items-start` + `md:min-h-[120px]` wrappers
- `components/mission-control/sparkline-chart.tsx` — `preserveAspectRatio=xMidYMid meet`, no fixed height
- `components/mission-control/cost-card.tsx` — `max-h-[72px] overflow-hidden` sparkline wrapper
- `components/mission-control/working-on-card.tsx` — `h-full` on root div
- `components/mission-control/controls-card.tsx` — `h-full` on root div
- `e2e/card-sizing.spec.ts` — new E2E tests (4 cases)
- Tests updated: `sparkline-chart.test.tsx`, `cost-card.test.tsx`

## State

- BL-062: **done** in backlog.md (Summary authored and appended)
- State.json: iteration 93, phase TRIAGE, backlog_item null
- Next: 2 P1 items pending — BL-063 (steer tab), BL-064 (cost plot scaling)
