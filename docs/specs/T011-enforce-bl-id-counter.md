# BL-011: Enforce BL-xxx ID Counter at Write Level — Prevent Duplicate IDs

## Overview

The `counters.next_bl_id` field in `state.json` is the canonical source for new backlog item IDs, but multiple entry points create backlog items and not all of them guarantee the counter is read, incremented, and written back correctly. This creates a race-prone, error-prone system where duplicate BL-xxx IDs can silently appear.

The fix is a single shared utility function `getNextBacklogId(projectPath)` that computes the correct next ID from both the counter in `state.json` AND a scan of the actual highest `BL-xxx` number in `backlog.md`, then atomically writes the updated counter back to `state.json`. Every code path that creates a backlog item must route through this function.

## Entry Points That Create Backlog Items

After auditing the codebase, the following entry points can produce new BL-xxx items:

1. **`POST /api/projects/[id]/backlog`** (`app/api/projects/[id]/backlog/route.ts`) — delegates to `runClaudeCommand` with `/redeye:backlog add: ...`. The Claude agent is responsible for picking the ID; it reads state.json but is not guaranteed to see the latest counter if another write happened concurrently.

2. **`PATCH /api/projects/[id]/backlog/[taskId]`** (`app/api/projects/[id]/backlog/[taskId]/route.ts`) — this edits existing items only (title, priority, details). It does NOT create new items. No ID allocation needed here.

3. **Agent file writes (HARDEN, TRIAGE, PLAN phases)** — Claude agents write directly to `backlog.md` and update `state.json` themselves. They read `counters.next_bl_id` from `state.json` but bypass the `getNextBacklogId` utility (which doesn't exist yet). The safest fix is to have the utility update `state.json` as a side effect so even if an agent forgets to sync the counter, a subsequent API call will self-heal.

4. **Manual edits** — out-of-band edits by humans or scripts. Cannot be controlled at the API layer, but the scan-based max ID detection in `getNextBacklogId` will recover the counter on the next API-triggered ID allocation.

The highest-risk path is path #1: the POST endpoint delegates ID assignment to a Claude subprocess which reads `state.json` at an arbitrary point. The PATCH path (#2) does not allocate IDs.

## Architecture Decisions

1. **Introduce `lib/backlog-id.ts`** — a new module exporting `getNextBacklogId(projectPath: string): Promise<string>`. It reads `state.json` for `counters.next_bl_id` and scans `backlog.md` for the maximum numeric suffix of all `BL-\d+` IDs, takes `max(counter - 1, max_found) + 1`, writes the updated counter back to `state.json`, and returns the formatted ID (e.g. `"BL-012"`).

2. **Atomic counter update** — `getNextBacklogId` writes `state.json` before returning the ID. This is not a true filesystem lock but is safe for the single-process Next.js API server. A file-level advisory lock (via a `.lock` file) would be overkill for the current scale and is explicitly out of scope.

3. **POST backlog route uses the utility** — rather than delegating ID assignment to Claude, the `POST /api/projects/[id]/backlog` route should call `getNextBacklogId` before delegating to the Claude agent, passing the pre-allocated ID as part of the command text. This removes Claude's responsibility for ID uniqueness.

4. **Scanner in `lib/redeye-files.ts`** — add a helper `scanMaxBacklogId(projectPath): Promise<number>` in `redeye-files.ts` that reads `backlog.md` and returns the highest numeric BL suffix found (0 if none). `getNextBacklogId` in `lib/backlog-id.ts` depends on this helper.

5. **No changes to `parseBacklog`** — the parser is read-only and does not need modification.

6. **`RedEyeState` type already has `counters.next_bl_id`** — no type changes needed.

## Sub-Tasks

### T1: Add `scanMaxBacklogId` helper in `lib/redeye-files.ts`
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Test strategy:** Unit tests in `lib/redeye-files.test.ts` covering: empty file, no BL items, single item, multiple items with gaps, BL numbers above 9 (double-digit padding)
- **Acceptance criteria:**
  - Function exported from `lib/redeye-files.ts` as `scanMaxBacklogId(projectPath: string): Promise<number>`
  - Reads `.redeye/backlog.md` using existing `safeRedeyePath` pattern
  - Returns 0 if file missing or no `BL-\d+` matches
  - Returns the highest numeric suffix found (e.g. 11 for `BL-011`)
  - All unit tests pass (`npx vitest run`)
- **Status:** done

### T2: Create `lib/backlog-id.ts` with `getNextBacklogId`
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Unit tests in `lib/backlog-id.test.ts` covering: counter ahead of backlog, backlog ahead of counter, equal, both zero, state.json missing (fallback to scan only), backlog.md missing (fallback to counter only)
- **Acceptance criteria:**
  - `getNextBacklogId(projectPath: string): Promise<string>` exported from `lib/backlog-id.ts`
  - Reads `counters.next_bl_id` from `state.json` (via `readState` from `redeye-files.ts`)
  - Calls `scanMaxBacklogId` from T1
  - Returns `"BL-" + String(nextId).padStart(3, "0")` where `nextId = max(stateCounter - 1, scanMax) + 1`
  - Writes the updated `counters.next_bl_id` back to `state.json` atomically (full JSON rewrite)
  - All unit tests pass (`npx vitest run`)
- **Status:** done

### T3: Update `POST /api/projects/[id]/backlog` to pre-allocate ID
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic)
- **Test strategy:** Manual smoke test — add a backlog item via the dashboard UI; verify the item in backlog.md uses the pre-allocated ID and state.json counter increments correctly. Unit test for the route is not feasible without mocking `runClaudeCommand`; rely on smoke test.
- **Acceptance criteria:**
  - Route calls `getNextBacklogId(project.path)` before invoking `runClaudeCommand`
  - Pre-allocated ID is appended to the Claude command: `/redeye:backlog add [BL-NNN]: <text>`
  - `state.json` counter is incremented before the Claude subprocess runs (preventing double-allocation if Claude also increments)
  - If `getNextBacklogId` throws, route returns 500 with appropriate error message
- **Status:** done

### T4: Write integration test for duplicate ID prevention
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic) / QA Lead
- **Test strategy:** Unit test in `lib/backlog-id.test.ts` — simulate two sequential calls to `getNextBacklogId` on the same projectPath (using a temp directory with realistic `state.json` and `backlog.md`); verify returned IDs are distinct and the counter advances correctly after each call
- **Acceptance criteria:**
  - Two sequential calls return `BL-NNN` and `BL-(NNN+1)` respectively
  - After both calls, `state.json` counter equals `NNN+2`
  - Test uses real filesystem writes via `tmp` or `os.tmpdir()` (no mocks of fs)
  - All tests pass (`npx vitest run`)
- **Status:** done

## Test Strategy Summary

- **Unit tests:** `lib/redeye-files.test.ts` (extend existing file) for `scanMaxBacklogId`; new `lib/backlog-id.test.ts` for `getNextBacklogId` and the sequential-calls integration case
- **Build check:** `npm run build` must pass after all changes
- **No E2E required:** The backlog ID allocation is a server-side concern; Playwright smoke tests for UI are not needed for this bug fix

## Questions / Risks

- **Q:** Should `getNextBacklogId` use a file lock to prevent concurrent allocations in a future multi-process setup? **Default:** No — out of scope for now; document the single-process assumption in the function's JSDoc.
- **Risk:** Claude agent subprocesses that write directly to `backlog.md` and `state.json` (phases HARDEN, TRIAGE, PLAN) bypass the new utility. Mitigation: `getNextBacklogId` will always scan backlog.md and self-heal the counter forward, so the next API-layer allocation will not reuse any agent-assigned ID. Full enforcement in agent code is deferred to a future hardening pass.
