# T025 — Wrap API Route Handlers in try-catch

**Type:** tech-debt  
**Priority:** P1  
**Iteration:** 39  
**Status:** done  

## Problem

Several Next.js API route handlers have no top-level try-catch. When an awaited call throws (e.g. session-manager error, file system failure, JSON parse error), Next.js surfaces an unhandled exception as an unstructured HTTP 500 with no JSON body. Clients (dashboard UI, CLI) cannot distinguish this from a network error and cannot display a useful message.

Affected files identified by audit:

| File | Issue |
|------|-------|
| `app/api/projects/[id]/restart/route.ts` | No try-catch — `stopSession` + `startSession` are uncaught |
| `app/api/projects/[id]/steer/route.ts` | No try-catch — `req.json()` + `runClaudeCommand` are uncaught |
| `app/api/projects/[id]/route.ts` (GET) | No try-catch — `readProjectDetail`, `isInitialized`, `getSessionStatus` uncaught |
| `app/api/projects/[id]/route.ts` (DELETE) | No try-catch — `removeProject` uncaught |
| `app/api/projects/[id]/answer/route.ts` | Inner `catch {}` silently discards state.json write errors |
| `app/api/projects/[id]/backlog/route.ts` | `runClaudeCommand` call after ID allocation is uncaught |

## Architecture Decisions

1. **Fix pattern:** Wrap the entire handler body (after parameter validation) in a single top-level `try { ... } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 }) }`. This is consistent with all already-guarded routes (start, stop, pause, init, cost, sessions, stream).

2. **Silent catch replacement:** The empty `catch {}` in `answer/route.ts` for the state.json update must log the error with `console.error` at minimum. It should not be promoted to a fatal error (the answer was already written to inbox.md successfully), but it must not be silent.

3. **No behavior changes:** This is purely defensive wrapping. No logic changes, no new abstractions, no new dependencies.

4. **req.json() error:** For routes that call `req.json()` before validation (steer), include the json parse inside the try-catch so malformed request bodies also return a structured 500 rather than crashing.

5. **Test strategy:** Each sub-task includes a unit test (vitest) that mocks the relevant dependency to throw and asserts the handler returns `{ status: 500, body: { error: <string> } }`. These tests also serve T022's goal of covering API routes.

## Sub-tasks

### T1 — Wrap restart route
- **File:** `app/api/projects/[id]/restart/route.ts`
- **Description:** Wrap the `POST` handler body in try-catch after the 404 guard. Both `stopSession` and `startSession` calls are covered. Return `{ error: e.message }` with status 500 on failure.
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test with vitest — mock `startSession` to throw, assert POST returns 500 JSON with `error` field.
- **Acceptance criteria:**
  - `stopSession` or `startSession` throwing causes a `{ error: string }` 500 response (not an unhandled exception)
  - All existing success-path behavior unchanged
  - Unit test passes
- **Status:** done

### T2 — Wrap steer route
- **File:** `app/api/projects/[id]/steer/route.ts`
- **Description:** Wrap the `POST` handler body (from `req.json()` onward) in try-catch. `runClaudeCommand` and json-parse errors are both covered.
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test — mock `runClaudeCommand` to throw, assert POST returns 500 JSON with `error` field.
- **Acceptance criteria:**
  - `runClaudeCommand` throwing causes a `{ error: string }` 500 response
  - Malformed request body (non-JSON) causes a `{ error: string }` 500 response
  - All existing success-path behavior unchanged
  - Unit test passes
- **Status:** done

### T3 — Wrap project GET handler
- **File:** `app/api/projects/[id]/route.ts` (GET export)
- **Description:** Wrap the `GET` handler body in try-catch after the 404 guard. Covers `getSessionStatus`, `isInitialized`, and `readProjectDetail`.
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test — mock `readProjectDetail` to throw, assert GET returns 500 JSON with `error` field.
- **Acceptance criteria:**
  - Any of the three async calls throwing causes a `{ error: string }` 500 response
  - All existing success-path behavior unchanged
  - Unit test passes
- **Status:** done

### T4 — Wrap project DELETE handler
- **File:** `app/api/projects/[id]/route.ts` (DELETE export)
- **Description:** Wrap the `DELETE` handler body in try-catch after the 404 guard. Covers `removeProject`.
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test — mock `removeProject` to throw, assert DELETE returns 500 JSON with `error` field.
- **Acceptance criteria:**
  - `removeProject` throwing causes a `{ error: string }` 500 response
  - All existing success-path behavior unchanged
  - Unit test passes
- **Status:** done

### T5 — Fix silent catch in answer route
- **File:** `app/api/projects/[id]/answer/route.ts`
- **Description:** Replace the empty `catch {}` block for the state.json update with `catch (stateErr) { console.error("[POST /answer] Failed to update state.json health counters:", stateErr) }`. The outer try-catch already handles fatal errors; this is a non-fatal best-effort update.
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test — mock `fs.writeFile` (second call) to throw, assert POST still returns 200 success, and console.error was called.
- **Acceptance criteria:**
  - state.json write failure logs an error but does not fail the request
  - Response remains `{ data: { success: true } }` when only state.json write fails
  - Unit test passes
- **Status:** done

### T6 — Wrap backlog POST runClaudeCommand call
- **File:** `app/api/projects/[id]/backlog/route.ts`
- **Description:** The `getNextBacklogId` call is already guarded. The subsequent `runClaudeCommand` call is not. Extend the try-catch to cover the `runClaudeCommand` call, or wrap the entire handler body in a single top-level try-catch (preferred — simpler).
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Test strategy:** Unit test — mock `runClaudeCommand` to throw, assert POST returns 500 JSON with `error` field.
- **Acceptance criteria:**
  - `runClaudeCommand` throwing causes a `{ error: string }` 500 response
  - `getNextBacklogId` throwing still causes a `{ error: string }` 500 response
  - All existing success-path behavior unchanged
  - Unit test passes
- **Status:** done

## Acceptance Criteria (Feature Level)

- All 6 route files have a top-level try-catch covering their primary logic
- All try-catch blocks return `NextResponse.json({ error: <string> }, { status: 500 })` on failure
- No silent `catch {}` blocks remain (all have at minimum `console.error`)
- `npm run build` passes with no type errors
- Unit tests for all 6 routes pass (`npx vitest run`)
- No regression on existing E2E behavior

## Open Questions

None — fix pattern is clear from existing guarded routes in the codebase.
