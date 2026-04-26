# T034 / T035 / T036 — Stop & Pause Controls Fix

**Spec covers:** T034 (Stop broken in mission control), T035 (Pause broken), T036 (Stop broken on home project cards). All three share the same root cause and same fix surface — grouped into one spec per CTO direction.

**Priority:** P1 (CEO requests, core session control)

---

## Problem

Clicking Stop or Pause from the browser has no observable effect on the running RedEye session:

1. **Stop (mission control + home cards)** — `POST /api/projects/[id]/stop` calls `stopSession()` which looks up a PID via `discoverPid()`. For CLI-started ralph-loop sessions there is no `.redeye/session-cto.pid` file, so the function falls back to `-1` (log-file-only heuristic) and `stopSession` explicitly refuses to kill when pid is `-1`. Result: no-op.
   Even when Control Tower itself spawned the session, `process.kill(pid, SIGTERM)` targets only the direct `claude --print` child. The Ralph Loop (ralph-loop stop hook) re-spawns Claude when the child exits, so SIGTERM ends the current claude call but the loop continues — from the UI it looks like "nothing happened."
   The Stop semantics the CEO wants (per `/redeye:stop` slash command) is **graceful** — write a `STOP` directive to `.redeye/steering.md`, CTO finishes current phase then exits. Current code does the wrong thing: a hard kill that the loop ignores.

2. **Pause** — `POST /api/projects/[id]/pause` already writes a directive to `.redeye/steering.md`, but writes `PAUSE ({timestamp})` which does not match the format `/redeye:pause` uses (`PAUSE — CEO directed pause at {ISO}`). The CTO's steering-parser keys off the canonical phrase. Result: directive ignored, no visible effect.
   Secondary issue: the UI gives no feedback that the directive was written (no toast, no visible state change), reinforcing the "button does nothing" perception.

3. **Home card Stop (T036)** — exact same `/stop` route; fixed by the Stop fix.

---

## Architecture decisions

1. **Stop = graceful directive, not process kill.** Align Control Tower with the `/redeye:stop` slash command: `POST /stop` writes `STOP — CEO directed stop at {ISO}` to `.redeye/steering.md` under `## Directives`. The CTO picks it up at the next phase boundary and exits cleanly. Remove the call to `stopSession()` from the route.

2. **Keep a separate `force-stop` path (future).** Do **not** remove `stopSession()` from `lib/session-manager.ts` — it is still useful for hard-kill scenarios (stall restart already uses it, and a future "Force Stop" button may want it). Scope of this spec: only the user-facing Stop button.

3. **Pause directive format.** Change pause route to write the canonical string `PAUSE — CEO directed pause at {ISO}` matching `/redeye:pause`. Preserve append-under-`## Directives` behavior.

4. **UI feedback.** Both Stop and Pause should show a transient toast/inline confirmation ("Stop directive written — team will finish current phase") so the user sees something happened immediately, even though `running` state does not flip for several minutes. Out of scope for this spec if toast infra doesn't exist — acceptable fallback: a brief disabled+label-swap on the clicked button ("Stopping…" / "Pausing…") for ~3 s.

5. **T036 is subsumed** by the Stop fix — the home card's Stop button calls the same `/stop` route. No separate code path change needed; just verify in tests.

6. **No session-manager changes required** for the user-facing fix. This keeps blast radius small and isolates the behavior change to two API route files plus a tiny UI tweak.

---

## Sub-tasks

### ST-1 — Rewrite `POST /api/projects/[id]/stop` to write STOP directive
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic, sonnet)
- **Files:** `app/api/projects/[id]/stop/route.ts`
- **Change:** Replace `await stopSession(project.path, "cto")` with steering.md directive append (mirror the pause route's write logic, but string = `STOP — CEO directed stop at {ISO}`). Drop the `stopSession` import.
- **Test strategy:** Unit test (vitest) with mocked `fs/promises`: asserts the directive string appears under `## Directives`, no `stopSession` invocation, returns `{ data: { success: true } }`. Add test for missing steering.md (graceful create). Add test for project-not-found 404.
- **Acceptance:**
  - `.redeye/steering.md` contains `STOP — CEO directed stop at <ISO>` after POST.
  - `stopSession` is **not** called.
  - Returns 200 `{ data: { success: true } }`.
- **Status:** done

### ST-2 — Fix pause directive string to match `/redeye:pause` canonical format
- **Size:** S
- **Dependencies:** none (can run parallel with ST-1)
- **Agent:** Dev (generic, sonnet)
- **Files:** `app/api/projects/[id]/pause/route.ts`
- **Change:** Replace `- PAUSE (${timestamp})` with `PAUSE — CEO directed pause at ${new Date().toISOString()}` (full ISO, not date-only; no leading dash — match the slash-command output exactly).
- **Test strategy:** Unit test: asserts directive string matches canonical format and is placed under `## Directives`. Regression test for existing file merge.
- **Acceptance:**
  - Directive text = `PAUSE — CEO directed pause at <full-ISO-timestamp>`.
  - Existing `## Directives` section preserved (new entry appended, not replacing).
  - 200 `{ data: { success: true } }`.
- **Status:** done

### ST-3 — UI feedback on Stop / Pause click
- **Size:** S
- **Dependencies:** ST-1, ST-2 (server contracts must be stable)
- **Agent:** Dev (generic, sonnet)
- **Files:** `app/project/[id]/page.tsx`, `components/mission-control/controls-card.tsx`, `app/page.tsx`, `components/project-card.tsx`
- **Change:** After a successful Stop/Pause POST, swap the button label to `Stopping…` / `Pausing…` and disable it for 3 seconds (local state, no global toast system needed). Also append a short caption under the Controls card: "Directive sent — team will finish current phase." that auto-hides after 5 s.
- **Test strategy:** Vitest + React Testing Library: render ControlsCard, click Stop, assert button becomes disabled and label changes. No Playwright needed for this iteration (E2E comes in DEPLOY smoke).
- **Acceptance:**
  - Click Stop → button shows `Stopping…`, disabled for 3 s, then reverts.
  - Click Pause → `Pausing…` for 3 s.
  - Home-card Stop (T036) also shows `Stopping…` feedback.
  - No console errors.
- **Status:** done

### ST-4 — Integration / Playwright smoke verification
- **Size:** S
- **Dependencies:** ST-1, ST-2, ST-3
- **Agent:** QA Lead (sonnet) during DEPLOY smoke
- **Files:** new screenshot under `screenshots/`, note in deploy report
- **Test strategy:** Playwright MCP: navigate to haze project, click Stop → verify `.redeye/steering.md` now contains `STOP — CEO directed stop at` via API or direct file read, screenshot UI showing "Stopping…" feedback. Repeat for Pause. Repeat Stop from home card (T036).
- **Acceptance:**
  - Screenshots show button feedback.
  - `.redeye/steering.md` has both STOP and PAUSE canonical strings after the test.
  - No 500 errors in network panel.
- **Status:** pending

---

## Test commands

- Unit: `npx vitest run`
- Build: `npm run build`
- E2E: Playwright via MCP at `http://localhost:3200` (no CLI command configured — QA Lead drives from DEPLOY).

## Rollout

Single commit cycle: BUILD implements ST-1–3 with tests, REVIEW checks contract alignment with `/redeye:stop` & `/redeye:pause`, DEPLOY runs full `npx vitest run` + build + smoke. Mark T034, T035, T036 done together at VERIFY.

## Risks

- **False sense of "stopped":** user may expect the process to die immediately. Mitigation: the "Directive sent — team will finish current phase" caption sets correct expectation. If CEO later asks for a hard-kill button, add it as a separate "Force Stop" control that calls `stopSession()` (explicitly scoped out here).
- **Steering.md parser drift:** if the CTO's triage parser is too strict about whitespace/formatting, the new PAUSE string must match exactly. Verified against `/Users/casa/redeye/commands/pause.md` which uses the same format. Flagged as question Q-004 below with default.

---

## Questions for CEO

See `.redeye/inbox.md` (Q-004). Proceeding with defaults if not answered in time.
