# T005: Verify onboarding wizard end-to-end

**Type:** test
**Priority:** P1
**Status:** pending
**Iteration:** 34
**Spec author:** VP Engineering

---

## Problem Statement

The onboarding wizard (`OnboardingWizard` component) is rendered when a project's
`initialized` flag is false. It collects vision, initial tasks, and commands, then
POSTs to `/api/projects/[id]/init`. No automated E2E test exists to verify this flow
works — a regression could silently break the only path for new users to configure
a project from the UI.

---

## Architecture Decisions

**AD-1: Use Playwright route interception, not a real uninitialized project.**
The test must not create or mutate real `.redeye/` files. Mock
`/api/projects/0` to return `initialized: false`, mock `/api/projects/0/init`
to return success. Follow the established pattern in
`e2e/start-stop-flow.spec.ts`.

**AD-2: Test file lives in `e2e/onboarding-wizard.spec.ts`.**
Keeps all Playwright specs in the `e2e/` directory alongside existing specs.

**AD-3: Test three scenarios.**
- Happy path: fill vision + one task + commands, click Initialize, wizard disappears
  and mission-control renders.
- Skip optional fields: skip vision and tasks (all optional), click through to
  Initialize; confirm init API is called with the required body shape.
- Cancel / back navigation: navigate backward through steps, confirm step labels
  update correctly and Back is hidden on the first step.

**AD-4: Do not test the init script itself.**
The shell script (`init-project.sh`) is out of scope; the test mocks the API
response. Integration of the shell script is covered by T001 manual smoke tests.

---

## Sub-tasks

### T1 — Write E2E spec: happy-path initialization

| Field | Value |
|-------|-------|
| **File** | `e2e/onboarding-wizard.spec.ts` |
| **Size** | M |
| **Agent** | Dev (sonnet) |
| **Dependencies** | none |
| **Status** | pending |

**Description:**
Create `e2e/onboarding-wizard.spec.ts`. Mock the following routes:

| Route | Method | Mock Response |
|-------|--------|---------------|
| `/api/projects/0` | GET | `{ data: { project: { initialized: false, running: false, ... }, state: {...}, ... } }` before init; `{ data: { project: { initialized: true, ... }, ... } }` after init call |
| `/api/projects/0/init` | POST | `{ data: { success: true, output: "Done!" } }` |
| `/api/projects/0/cost` | GET | `{ data: { session: 0, total: 0 } }` |

Test `"happy path: fill wizard and initialize project"`:
1. Navigate to `/project/0`.
2. Confirm wizard is rendered: `"Let's set up RedEye"` heading visible.
3. Click "Get Started" — step advances to Vision.
4. Fill vision textarea with a test string.
5. Click "Next" — step advances to Tasks.
6. Type a task name, press Enter or click Add — chip appears.
7. Click "Next" — step advances to Commands.
8. Fill deploy command input.
9. Click "Next" — step advances to Review.
10. Confirm vision text and task name are visible in the review summary.
11. Click "Initialize Project".
12. Confirm `POST /api/projects/0/init` was called with `{ vision: "...", firstTask: "...", deployCommand: "..." }`.
13. Wait for wizard to disappear and mission-control grid to appear (WorkingOnCard or HealthCard visible).

**Acceptance criteria:**
- Test passes with `npx playwright test e2e/onboarding-wizard.spec.ts`.
- `POST /api/projects/0/init` receives correct body (assert via `page.route` request capture).
- After init, wizard is no longer in the DOM; mission-control cards are visible.

---

### T2 — Write E2E spec: skip optional fields

| Field | Value |
|-------|-------|
| **File** | `e2e/onboarding-wizard.spec.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1 |
| **Status** | pending |

**Description:**
Add test `"skip optional fields: navigate through without filling anything"`:
1. Navigate to `/project/0`.
2. Click "Get Started".
3. Click "Next" on Vision (leave empty).
4. Click "Next" on Tasks (leave empty).
5. Click "Next" on Commands (leave all empty).
6. On Review, confirm "Not set" appears under Vision, "None added" under Tasks.
7. Click "Initialize Project".
8. Confirm init API is called (body may have no keys or empty strings — assert it is called).
9. Wizard disappears, mission-control renders.

**Acceptance criteria:**
- Test passes with `npx playwright test`.
- Wizard allows skipping all optional fields without validation errors.

---

### T3 — Write E2E spec: back-navigation and step labels

| Field | Value |
|-------|-------|
| **File** | `e2e/onboarding-wizard.spec.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1 |
| **Status** | pending |

**Description:**
Add test `"back navigation: step labels update correctly"`:
1. Navigate to `/project/0`.
2. Confirm "Back" button is not visible on the Welcome step.
3. Click "Get Started" to advance to Vision.
4. Confirm step label shows "Step 2 of 5 — Vision".
5. Click "Next" to advance to Tasks.
6. Confirm step label shows "Step 3 of 5 — Tasks".
7. Click "← Back".
8. Confirm step label returns to "Step 2 of 5 — Vision".
9. Confirm the vision textarea still contains previously entered text (state is preserved across navigation).

**Acceptance criteria:**
- Test passes with `npx playwright test`.
- Step counter and label match the current step.
- Back button hidden on Welcome, visible on all subsequent steps.
- State preserved when navigating back.

---

### T4 — Verify full test suite green

| Field | Value |
|-------|-------|
| **File** | all |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1, T2, T3 |
| **Status** | pending |

**Description:**
Run `npx vitest run` (unit tests) and `npx playwright test e2e/onboarding-wizard.spec.ts`
(E2E). Confirm zero failures. If the Playwright config needs updating (e.g., baseURL
not set), fix it.

**Acceptance criteria:**
- `npx vitest run` exits 0.
- `npx playwright test e2e/onboarding-wizard.spec.ts` exits 0 with all 3 tests passing.
- No changes to existing tests needed.

---

## Files to Change

| File | Change type |
|------|-------------|
| `e2e/onboarding-wizard.spec.ts` | New file — 3 Playwright test cases |
| `playwright.config.ts` | Minor update if baseURL needs to reference port 3200 (verify first) |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wizard step count label mismatches actual component | Low | Read `OnboardingWizard` STEP_LABELS before writing assertions |
| `initialized: false` mock not triggering wizard render | Low | Confirmed in page.tsx: `!detail.project.initialized` renders `<OnboardingWizard>` |
| Race condition: wizard disappears before assertion | Low | Use `waitForSelector` with `{ state: 'hidden' }` on wizard heading |
| Init POST body shape differs from API contract | Low | Capture and log body in route mock; assert keys present |
