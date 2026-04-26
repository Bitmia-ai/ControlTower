# BL-049 — Expand E2E Test Coverage

**Type:** test
**Priority:** P1
**Status:** planned
**Author:** VP Engineering (iteration 79)

## Problem

Current Playwright coverage is limited to smoke tests, the logo mark, backlog
done-section collapse, dark/light mode, start/stop flow, aria labels, per-task
cost recording, home project status, backlog summary section, and the onboarding
wizard. The backlog CRUD flow via dialog, and the cost-card invariant assertion
are not covered.

The existing `start-stop-flow.spec.ts` already covers most of backlog item #2
(start/stop button state transitions), so this spec augments coverage rather
than duplicating it.

## Acceptance Criteria

1. **Backlog CRUD spec** — new file `e2e/backlog-crud.spec.ts`
   - Add a task via the AddBacklogDialog (POST `/api/projects/0/backlog` mocked)
   - Verify the new item appears in the backlog list
   - Navigate to the detail page (`/project/0/backlog/BL-NEW`) and verify title/priority fields render
   - All APIs mocked via `page.route()` — no real filesystem writes

2. **Cost card spec** — new file `e2e/cost-card.spec.ts`
   - Navigate to `/project/0` with mocked cost and project-detail APIs
   - Verify the cost card renders (heading "Cost" visible)
   - Verify session cost value is non-negative (no leading negative sign)
   - Verify total cost value is non-negative
   - Verify session cost <= total cost in the DOM (invariant)

Both specs follow the existing Playwright route-interception pattern from
`e2e/start-stop-flow.spec.ts`: mock all API calls, no real server required.

## File Changes

### New files
- `e2e/backlog-crud.spec.ts` — ~90 lines
- `e2e/cost-card.spec.ts` — ~70 lines

### No changes to
- Application source code
- Unit test files
- Any `.redeye/` control files

## Sub-tasks

### T1 — Backlog CRUD E2E spec (S)
Write `e2e/backlog-crud.spec.ts` with:
- Mock `GET /api/projects/0` returning a minimal project detail (running: false)
- Mock `GET /api/projects/0/backlog` returning empty initial list
- Mock `POST /api/projects/0/backlog` returning `{ data: { success: true, id: "BL-001" } }`
  and also update the GET stub to return the new item on subsequent calls
- Mock `GET /api/projects/0/backlog/BL-001` returning a minimal item
- Mock `GET /api/projects/0/cost` returning `{ data: { session: 0, total: 0 } }`
- Mock `GET /api/projects/0/stream` returning empty SSE
- Test flow:
  1. Navigate to `/project/0/backlog`
  2. Click "Add to Backlog" button (aria-label or text match)
  3. Fill in the task title field in the dialog
  4. Submit the form
  5. Verify the new item title appears in the list
  6. Click the item link to navigate to the detail page
  7. Verify the title is displayed on the detail page
  8. Verify the priority badge is visible

### T2 — Cost card E2E spec (S)
Write `e2e/cost-card.spec.ts` with:
- Mock `GET /api/projects/0` with running: false, minimal state
- Mock `GET /api/projects/0/cost` returning `{ data: { session: 1.25, total: 42.50 } }`
- Mock `GET /api/projects/0/stream` returning empty SSE
- Test flow:
  1. Navigate to `/project/0`
  2. Wait for cost card to finish loading
  3. Assert "Cost" heading is visible
  4. Extract session cost text and parse as float; assert >= 0
  5. Extract total cost text and parse as float; assert >= 0
  6. Assert sessionCost <= totalCost

## Implementation Notes

- Use `page.route()` intercept pattern with `route.fulfill()` — matches existing tests
- Mock the stream route with an empty SSE body to avoid hanging connections:
  `body: "data: {}\n\n", contentType: "text/event-stream"`
- The cost card renders text in format `$X.XX` — use `.textContent()` and strip `$` to parse
- The AddBacklogDialog opens when the "Add to Backlog" button is clicked on the
  backlog page. The dialog has a text input for the task title and a submit button.
- After submitting, the dialog closes and `onAdded()` triggers a re-fetch. The mock
  for `GET /api/projects/0/backlog` should return the new item after the POST.
- Use `await page.waitForSelector()` or `await expect(locator).toBeVisible()` with
  sufficient timeout (default 5000ms should be fine for mocked routes).

## Test Infrastructure

No new test infrastructure required. Uses existing Playwright config at
`playwright.config.ts` (baseURL: `http://localhost:3200`, chromium only).

The specs should follow the `/** ... */` JSDoc block comment style used in existing
E2E files, identifying the BL item being tested.
