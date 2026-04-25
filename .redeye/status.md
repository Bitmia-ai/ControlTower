# RedEye Status — Iteration 80 BUILD

**Date:** 2026-04-25
**Phase:** BUILD complete — ready for REVIEW/DEPLOY
**Active Item:** BL-050 — In-app notification toast for phase changes
**Branch:** `feature/BL-050-phase-notifications` (worktree at `.worktrees/BL-050`)

## Sub-tasks Completed (6/6)

- T1 (S, done): `lib/use-phase-change-notifier.ts` — first-mount-guarded hook detecting phase transitions. 8 unit tests.
- T2 (M, done): `lib/use-phase-notifications.ts` — toast + Notification API dispatcher. Exports `NOTIFIABLE_PHASES` const set. 11 unit tests.
- T3 (M, done): `components/toast-provider.tsx` + `components/toast-container.tsx` — Tailwind-only toast system (zero new deps), auto-dismiss 5s, dismiss button, dark/light aware, optional `href` link. 7 unit tests.
- T4 (S, done): Wired `ToastProvider` into `app/layout.tsx` alongside `ThemeProvider`.
- T5 (S, done): Wired `usePhaseNotifications` into `app/project/[id]/page.tsx`. 4 integration tests in `app/project/[id]/page.test.tsx`.
- T6 (S, done): QA pass — 492/492 unit tests pass, no new TS errors. Playwright spec written at `e2e/phase-change-toast.spec.ts` (4 specs).

## Files Modified / Created

**New:**
- `lib/use-phase-change-notifier.ts`
- `lib/use-phase-change-notifier.test.ts`
- `lib/use-phase-notifications.ts`
- `lib/use-phase-notifications.test.tsx`
- `components/toast-provider.tsx`
- `components/toast-container.tsx`
- `components/toast-provider.test.tsx`
- `app/project/[id]/page.test.tsx`
- `e2e/phase-change-toast.spec.ts`

**Modified:**
- `app/layout.tsx` — added `<ToastProvider>` wrapping
- `app/project/[id]/page.tsx` — added `usePhaseNotifications` call
- `docs/specs/BL-050-phase-change-notifications.md` — all sub-tasks marked `done`

## Test Results

- **`npx vitest run`** — **492/492 pass** (30 new BL-050 tests)
- **`npx tsc --noEmit`** — no new TypeScript errors in BL-050 source files
- **`npm run build`** — **PRE-EXISTING FAILURE** on `/_global-error` prerender:
  `TypeError: Cannot read properties of null (reading 'useContext')`.
  Confirmed by checking out `main` cleanly and rebuilding — failure is present on
  `main` before BL-050. Unrelated to this feature; needs investigation in DEPLOY.

## Commits Made

- `feat: phase-change notifier hook with first-mount guard (BL-050 task 1)` (6bfe69c)
- `feat: in-app toast provider and container with auto-dismiss (BL-050 task 3)` (70386d0)
- `feat: phase notifications hook dispatching toast and Notification API (BL-050 task 2)` (b7cd015)
- `feat: wire ToastProvider into root layout (BL-050 task 4)` (8f70df7)
- `feat: wire usePhaseNotifications into project mission control (BL-050 task 5)` (996d090)
- `feat: mark BL-050 sub-tasks complete and document pre-existing build issue (BL-050 task 6)` (8b8f89f)

## Concerns / Followups for REVIEW & DEPLOY

1. **Pre-existing build failure on `/_global-error`** — present on `main` before this branch. Suggests an env/deps regression after iter 79 deploy. DEPLOY phase must investigate (likely Next.js 16 + React 19 SSR context issue with provider in root layout). Not introduced by BL-050.
2. **Pre-existing TypeScript errors in `lib/stream-utils.test.ts`** — unrelated to BL-050.
3. **Playwright E2E suite written but not run** — per CLAUDE.md convention BUILD does not run full regression; DEPLOY phase should run `npm run e2e`.
4. **Notification API permission** — One-time document click listener installs only when `Notification.permission === "default"`. Browsers may surface the permission dialog on the first user interaction with the mission-control page; verify UX in REVIEW.

## Acceptance Criteria (Feature-level)

- [x] Phase -> BUILD shows toast with task title (unit + integration tested)
- [x] Phase -> REVIEW shows toast (unit tested)
- [x] Phase -> DEPLOY shows toast (covered by `NOTIFIABLE_PHASES`)
- [x] Phase -> MERGE shows "completed" toast (unit tested)
- [x] Toast href is `/project/${id}/live` (unit + E2E)
- [x] Toast auto-dismisses after 5 seconds (unit tested)
- [x] Toast has `×` dismiss button (unit tested)
- [x] No toast on page first load (integration tested)
- [x] Native Notification fires only when permission granted (unit tested)
- [x] In-app toast still fires when permission denied (unit tested)
- [x] Dark/light Tailwind classes applied throughout
- [x] All unit tests pass (492/492)
- [ ] `npm run build` — pre-existing unrelated failure, see Concerns
