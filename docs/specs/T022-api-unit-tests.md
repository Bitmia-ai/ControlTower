# T022: Add Unit Tests for Critical API Routes

**Priority:** P1
**Type:** test
**Tier:** S (add test files, no production code changes)
**Status:** planned

## Context

T022 was filed during the HARDEN phase (iter 37) to add unit tests to all untested API routes. Since then, significant test coverage has been added across multiple iterations. Current coverage audit (as of iter 48):

**Already tested:**
- `GET /api/projects` — route.test.ts
- `GET/PATCH/DELETE /api/projects/[id]` — route.test.ts
- `POST /api/projects/[id]/stop` — route.test.ts
- `POST /api/projects/[id]/restart` — route.test.ts
- `POST /api/projects/[id]/pause` — route.test.ts
- `POST /api/projects/[id]/answer` — route.test.ts
- `POST /api/projects/[id]/backlog` (add item) — route.test.ts
- `GET /api/projects/[id]/cost` — route.test.ts
- `POST /api/projects/[id]/cost-snapshot` — route.test.ts
- `POST /api/projects/[id]/steer` — route.test.ts
- `GET /api/projects/[id]/transcript-status` — route.test.ts

**Still missing:**
- `POST /api/projects/[id]/start` — session lifecycle (P1)
- `GET/PATCH/DELETE /api/projects/[id]/backlog/[taskId]` — CRUD (P1)
- `POST /api/projects/[id]/init` — project initialization (P2)
- `GET /api/projects/[id]/sessions` — session history listing (P2)
- `GET /api/projects/[id]/stream` — SSE stream (not unit-testable; skip)

## Architecture Decisions

### AD-1: Priority Scope
Focus on the two P1-critical routes: `start` (session lifecycle) and `backlog/[taskId]` (CRUD operations). `init` and `sessions` are lower risk and deferred to a follow-up.

### AD-2: Test Pattern
Follow the established pattern from `stop/route.test.ts`:
- Mock `@/lib/projects` (`getProjectByIndex`)
- Mock `@/lib/session-manager` where needed
- Mock `fs/promises` default for file operations
- Use `NextRequest` with `Promise.resolve({ id, taskId })` for params
- `beforeEach(() => vi.clearAllMocks())`
- Test: 404 when project not found, success path, error path

### AD-3: Start Route
`POST /api/projects/[id]/start` calls `startSession(project.path, "cto")` and returns `{ data: sessionInfo }`. Tests:
1. 404 when `getProjectByIndex` returns null
2. Success: returns `{ data: sessionInfo }` with status 200
3. Error: `startSession` throws → returns `{ error: "..." }` with status 500

### AD-4: Backlog/[taskId] Routes
Three methods: GET, PATCH, DELETE. Tests per method:
- GET: 404 project not found, 404 item not found, 200 with item (with and without cost_usd enrichment)
- PATCH: 404 project not found, 200 with valid title/priority update, 400 on path traversal attempt
- DELETE: 404 project not found, 200 on successful deletion

## Sub-Tasks

### T1: Unit tests for POST /api/projects/[id]/start
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic, sonnet)
- **File:** `app/api/projects/[id]/start/route.test.ts` (create new)
- **Test cases:**
  1. Returns 404 when project not found
  2. Returns 200 with `{ data: sessionInfo }` on success
  3. Returns 500 with error message when `startSession` throws
- **Acceptance criteria:**
  - All 3 tests pass
  - Full vitest suite remains green (327/327 + 3 new)
- **Status:** done

### T2: Unit tests for GET/PATCH/DELETE /api/projects/[id]/backlog/[taskId]
- **Size:** M
- **Dependencies:** none
- **Agent:** Dev (generic, sonnet)
- **File:** `app/api/projects/[id]/backlog/[taskId]/route.test.ts` (create new)
- **Test cases:**
  - GET (4 cases): 404 project not found, 404 item not found, 200 basic item, 200 item with cost_usd enrichment
  - PATCH (3 cases): 404 project not found, 200 title/priority update, validation (no-op if no valid fields)
  - DELETE (2 cases): 404 project not found, 200 on deletion
- **Acceptance criteria:**
  - All 9+ tests pass
  - Full vitest suite remains green (330/330 + new tests)
- **Status:** done

## Out of Scope

- `init` route tests (low risk, no session/data mutations)
- `sessions` route tests (read-only history listing)
- `stream` route tests (SSE not unit-testable with vitest/JSDOM)

## Acceptance Criteria (overall)

- `npx vitest run` exits 0 with all new tests passing
- No production code changes — test-only
- Each new test file follows the established mock pattern from stop/restart/pause route tests
