# BL-003: Test Start/Stop flow end-to-end

**Status:** done
**Priority:** P1
**Type:** test

---

## Problem

The Start/Stop flow has never been tested end-to-end via Playwright. We need to verify the UI transitions work correctly.

---

## Sub-tasks

### T1 — Write Playwright E2E test for Start/Stop flow [M]
- File: e2e/start-stop-flow.spec.ts
- Navigate to /project/0 (haze)
- Verify Start button is visible, click it
- Verify button changes to Stop
- Verify Working On card shows activity (green dot, phase label)
- Click Stop, verify session stops
- Verify UI returns to idle state ("RedEye is idle")
- Note: this test will actually start a claude session — it needs special handling. If starting a real session is too risky in test, verify the API contract instead.

### T2 — Build + test verification [S]
- npm run build + npx vitest run
