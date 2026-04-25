# DEPLOY Status — BL-058 (Schedules UI Operative) — Iteration 90

**Timestamp:** 2026-04-25T14:00:00Z
**Phase:** DEPLOY
**Phase status:** complete

## Build

**Command:** `NODE_ENV=production npm run build`
**Result:** PASS — compiled successfully in 1814ms (Turbopack)

All routes dynamic (ƒ), including new `/api/projects/[id]/schedules/run` and `/project/[id]/schedules`. No prerender errors. One Turbopack NFT warning (pre-existing, unrelated to BL-058).

## Tests

**Unit/integration:** `npx vitest run`
**Result:** 662/662 passed (67 test files) — PASS

**E2E:** No CLI command configured — skipped.

## Regression tier

This is deploy iteration 90; last full regression was iter 86 (4 deploys ago, threshold 3). Full regression overdue per counter but E2E has no configured CLI command. Unit/integration suite treated as regression proxy — all 662 pass.

## Git

**Tag:** `last-good-deploy-iter90-bl058`
**Branch:** main

## Verdict

**RECOMMEND: VERIFY**

Deploy succeeded. Production build clean. All 662 tests pass. Proceed to VERIFY to confirm schedules UI is operative at http://localhost:3200.
