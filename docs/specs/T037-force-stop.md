# T037: Add Force Stop Button (Hard Kill) for Unresponsive Sessions

## Overview

Add a "Force Stop" button to the Controls card (mission control page) that hard-kills the underlying Claude process when the session is stuck or unresponsive. Complements the existing graceful Stop button, which only writes a STOP directive and waits for the CTO to exit at the next phase boundary.

## Background

- Graceful Stop (`POST /api/projects/[id]/stop`): writes `STOP` directive to `.redeye/steering.md`. The CTO process reads this at its next phase boundary (5–15 min) and exits cleanly. Useless for a hung/stalled session.
- `session-manager.ts` already has a `stopSession()` function that sends SIGTERM then SIGKILL after 10s. This is the right primitive for Force Stop.
- The auto-restart mechanism (`autoRestartEnabled` Set) must be disabled before killing, or the process will be respawned immediately.

## Architecture Decisions

### AD-1: New API route, not reusing /stop
Force Stop is a fundamentally different action — immediate process kill vs. graceful shutdown. A dedicated route (`POST /api/projects/[id]/force-stop`) makes the distinction clear in logs, UI, and tests.

### AD-2: Reuse `stopSession()` from session-manager
`stopSession()` already correctly: disables auto-restart, sends SIGTERM, waits up to 10s, falls back to SIGKILL, then clears the PID. Force Stop simply calls this same function. No new kill logic needed.

### AD-3: UI confirmation via Shift+click (not a modal)
The CEO asked the button to be "clearly differentiated". A modal dialog adds friction. Shift+click achieves immediate differentiation: normal click shows an inline warning prompt ("Hold Shift and click to force-stop"), Shift+click executes immediately. This is consistent with how power users expect destructive actions to work in dashboards.

### AD-4: Force Stop button always visible when running (not only when stalled)
The session might be unresponsive without triggering the stall detection heuristic (e.g. hung on a long tool call that updates the transcript). Show Force Stop whenever the session is running.

### AD-5: No backlog state change on Force Stop
Leave `state.json` phase and backlog_item as-is. The next TRIAGE will resolve state naturally. This avoids partial-state corruption from a mid-phase kill.

### AD-6: Home page ProjectCard — no Force Stop
The home page card has limited real estate and is a navigation shortcut, not a full control panel. Force Stop is a power-user action; it belongs only on the mission control page (Controls card). Adding it to every project card would add clutter and risk mis-clicks. Scope: mission control only.

## Sub-tasks

### T1: API route — `POST /api/projects/[id]/force-stop`
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/force-stop/route.ts`
- **Logic:**
  1. Resolve project by index (same pattern as `/stop/route.ts`).
  2. Call `stopSession(project.path, "cto")` from `lib/session-manager.ts`.
  3. Return `{ data: { success: true } }` on success, structured `{ error }` on failure.
- **Test strategy:** Unit test with vitest — mock `session-manager.stopSession`, assert it's called with correct args; assert 404 when project not found; assert 500 when stopSession throws.
- **Acceptance criteria:**
  - Route calls `stopSession()` (not just writes to steering.md)
  - PID file is cleared after the call
  - Returns 200 `{ data: { success: true } }` when process killed
  - Returns 404 when project index invalid
  - Returns 500 with `{ error }` on exception
- **Status:** done

### T2: Unit tests for force-stop route
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/force-stop/route.test.ts`
- **Test strategy:** vitest with mocked `lib/projects` and `lib/session-manager`
- **Cases:**
  1. Happy path: valid project → stopSession called → 200 success
  2. Project not found: invalid index → 404
  3. stopSession throws: → 500 with error message
- **Acceptance criteria:** All 3 tests pass; `npx vitest run` green
- **Status:** done

### T3: ControlsCard UI — Force Stop button with Shift+click confirmation
- **Size:** M
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `components/mission-control/controls-card.tsx`
- **Logic:**
  - Add `onForceStop?: () => void` prop to `ControlsCardProps`
  - Add `PendingAction` type extension: `"force-stop"`
  - New button rendered below Stop/Pause row when `running === true`
  - Button label: "Force Stop" (default) → "Force Stopping…" (pending)
  - Styling: outline-style with red-700 border and text (not filled red — visually distinct from the graceful Stop which is filled red). Use `border border-red-700 text-red-600 dark:text-red-400 hover:bg-red-950/30` class pattern.
  - Click behavior:
    - Normal click: sets `forceStopPrompt` state to true, shows inline warning text: "Hold Shift and click Force Stop to confirm hard kill." Warning auto-dismisses after 4s.
    - Shift+click: if `forceStopPrompt` is shown OR shift key held (`e.shiftKey`): executes immediately — sets `pending = "force-stop"`, calls `onForceStop?.()`, shows "Force Stopping…" label for 3s.
  - While `pending === "force-stop"`: all other buttons (Stop, Pause, Restart) are disabled.
- **Acceptance criteria:**
  - Force Stop button visible when running
  - Normal click shows warning text (no action)
  - Shift+click executes force stop
  - "Force Stopping…" label appears during pending
  - Other buttons disabled during force-stop pending
  - Button uses outline red styling distinct from solid-red graceful Stop
- **Status:** done

### T4: Wire Force Stop in mission control page
- **Size:** S
- **Dependencies:** T3
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/page.tsx`
- **Logic:**
  - Add `handleForceStop` async function:
    ```ts
    async function handleForceStop() {
      try {
        await fetch(`/api/projects/${id}/force-stop`, { method: "POST" });
        await fetchDetail();
      } catch {
        // ignore
      }
    }
    ```
  - Pass `onForceStop={handleForceStop}` to `<ControlsCard />`
- **Acceptance criteria:**
  - ControlsCard receives `onForceStop` prop
  - Clicking Force Stop (Shift+click) posts to `/force-stop`
  - UI refreshes after call
- **Status:** done

### T5: E2E smoke verification with Playwright
- **Size:** S
- **Dependencies:** T1, T3, T4
- **Agent:** Dev (generic)
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Navigate to mission control for haze project
  2. If session not running, start it
  3. Verify "Force Stop" button is visible
  4. Verify normal click shows warning text (no force-stop fired)
  5. Shift+click Force Stop — verify "Force Stopping…" label appears
  6. Verify other buttons disabled during pending
  7. Screenshot for record
- **Note:** This is not an automated test file — Playwright MCP is used interactively at VERIFY time.
- **Acceptance criteria:** All 7 steps pass visually
- **Status:** pending

## Files Touched

| File | Change |
|------|--------|
| `app/api/projects/[id]/force-stop/route.ts` | New — force-stop API route |
| `app/api/projects/[id]/force-stop/route.test.ts` | New — unit tests |
| `components/mission-control/controls-card.tsx` | Add Force Stop button with Shift+click |
| `app/project/[id]/page.tsx` | Wire `onForceStop` handler |

## No Changes Required

- `lib/session-manager.ts` — `stopSession()` already handles SIGTERM/SIGKILL/clearPid correctly. No modifications needed.
- `components/project-card.tsx` — Force Stop scoped to mission control only (AD-6).
- `app/api/projects/[id]/stop/route.ts` — Graceful stop untouched.

## Test Strategy Summary

- Unit tests (vitest): T2 covers the new route (3 test cases). Existing 343-test suite must remain green.
- E2E: Playwright MCP at VERIFY time (T5).
- No new unit tests needed for ControlsCard (pure UI state, no business logic).

## Questions Posted

None. CEO's request is unambiguous; architecture decisions are straightforward given existing session-manager primitives.
