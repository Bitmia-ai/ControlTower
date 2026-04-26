# RedEye Status — Iteration 109 PLAN

**Phase:** PLAN complete
**Date:** 2026-04-26

## Triage

No `pending-triage` items in `## Discovered` — all discovered items already `done` or `wont-do`.

CEO Requests pending: T079 (P1, selected), T078 (P1, queued). T076 (P2, planned).

Selected item confirmed: **T079 — PWA auto-zooms when typing on phone** (P1, highest priority).

## Plan Summary

Root cause: `viewport` export in `app/layout.tsx` lacks `maximumScale` and `userScalable` properties, allowing iOS/Android browsers to auto-zoom on input focus in PWA mode.

Fix: single addition to the `Viewport` constant. 2 sub-tasks (both S-tier):
- T1: add `maximumScale: 1, userScalable: false` to viewport constant + update existing layout test
- T2: build smoke — grep built HTML for `maximum-scale=1`

No new files, no new dependencies, no API changes.

## Spec

docs/specs/T079-pwa-viewport-zoom-fix.md

## Questions

None filed — fix is fully specified by the task description.
