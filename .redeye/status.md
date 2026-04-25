# MERGE Status — BL-058 (Schedules UI Operative) — Iteration 92

**Timestamp:** 2026-04-25T10:30:00Z
**Phase:** MERGE
**Result:** CLEAN — BL-058 fully merged to main

## Merge Summary

**Branch strategy:** No worktree used — all BL-058 commits were made directly on `main`.

**Commits merged into main:**
- `8ac0872` — feat: BL-058 schedules operative — T1-T6 complete (iteration 90)
- `254f76b` — fix: nested button in ScheduleRow — RunButton is now sibling of expand button (BL-058 REVIEW)

**Key files changed (BL-058):**
- `app/global-error.tsx` — standalone client component, no imports
- `lib/theme-context.tsx` — custom ESM ThemeProvider replacing next-themes
- `components/client-providers.tsx` — ThemeProvider + ToastProvider + header
- `app/layout.tsx` — simplified to use ClientProviders
- `scripts/patch-next.mjs` + `package.json` — postinstall patch for Next.js 16.2.4 prerender bug
- `app/api/projects/[id]/schedules/run/route.ts` — new POST endpoint
- `components/schedules/schedule-list.tsx` — RunButton as sibling (not nested in expand button)
- `.redeye/schedules.md` — SCHED-1 sample schedule

## BL-058 Outcome

**Status:** done
**Merged:** 2026-04-25 (iter 90, confirmed iter 92)
**Summary:** Made schedules UI operative by fixing the global-error.tsx build failure (ClientProviders with custom ESM ThemeProvider, postinstall patch for Next.js 16.2.4 prerender bug), adding a POST /api/projects/[id]/schedules/run endpoint, restructuring the Run now button as a sibling of the expand button (not nested), seeding SCHED-1, and threading projectId through the schedules page. 662/662 unit tests pass, production build clean.

## Active Claims

None. `.active-claims.json` has no active claims.

## Next Phase

**TRIAGE** then **BUILD BL-061** — Remove keyboard shortcut badges from navigation buttons. PLAN is already complete (spec at `docs/specs/BL-061-remove-kbd-badges.md`). 4 pending P1 items: BL-061, BL-062, BL-063, BL-064.
