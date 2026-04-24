# BL-010: Detect and recover from stalled sessions

**Status:** done  
**Priority:** P1  
**Type:** feature  
**Spec author:** VP Engineering  
**Date:** 2026-04-24

---

## Problem

When `claude --print` hits a quota wall or a permission prompt it cannot answer
in headless mode, the process hangs indefinitely. The Control Tower dashboard
shows the session as "running" and the user has no way to know it is stuck.

---

## Architecture Decisions

### AD-1: Stall detection via log file mtime polling in session-manager.ts

The session manager already holds PID information and manages the process
lifecycle. A periodic health check interval (per-session) will stat the
transcript/log file and compare its mtime to the current time. If the process
is alive but no new output has appeared for 10 minutes, the session is marked
stalled. The same `spawnAndWatch` loop that handles process-exit restarts is
extended to handle stall restarts.

**Source of truth for log file:** use `resolveTranscriptFile(projectPath)` from
`lib/transcript-file-resolver.ts` — exactly the same logic the Live tab uses.
This covers both Control Tower session logs and CLI transcript files, and avoids
hardcoding paths.

### AD-2: lastActivity timestamp added to SessionInfo

`SessionInfo` gains an optional `lastActivity: number | null` (Unix ms). It is
populated by `makeSessionInfo` by stat-ing the resolved transcript file's
`mtimeMs`. This requires no persistence — it is recomputed on every call to
`getSessionStatus`. The `status` field gains a new literal value `"stalled"`.

### AD-3: Stalled state communicated via existing sessions API

`GET /api/projects/[id]/sessions` already returns `SessionStatus`. When the CTO
session has `status: "stalled"`, the mission-control page detects it and renders
the warning and Restart button. No new API route is needed.

### AD-4: Restart API route (new: POST /api/projects/[id]/restart)

A dedicated `/restart` route performs stop + start atomically in the server,
so the UI can trigger a clean restart with one fetch call. The route reuses
`stopSession` and `startSession` from `session-manager.ts`.

### AD-5: Controls card receives stalled prop and renders amber border + Restart button

`ControlsCard` is extended with an optional `stalled?: boolean` prop. When
`stalled` is true the card's left border turns amber (`border-l-amber-500`),
a warning badge is shown, and a Restart button replaces or augments the Stop
button. The Steer and + Backlog secondary buttons remain available.

### AD-6: No persistent stall state — recomputed every poll cycle

The 5-second polling loop in the mission-control page already calls
`/api/projects/[id]`. Rather than adding a separate stall flag to state.json,
`makeSessionInfo` derives `status: "stalled"` live. This keeps state.json clean
and avoids stale-stall bugs if the file is updated while the page is closed.

---

## Sub-tasks

### T1 — Extend SessionInfo type and SessionStatus (S)

**File:** `lib/redeye-types.ts`

- Add `lastActivity: number | null` to `SessionInfo`.
- Add `"stalled"` to the `status` union type: `"running" | "stalled" | "stopped"`.

**Dependencies:** none  
**Agent:** Dev (generic)  
**Test strategy:** unit — update existing type-level tests; verify `makeSessionInfo`
returns correct status in T2 tests.  
**Acceptance criteria:**
- TypeScript compiles with the extended type.
- All existing callers that pattern-match on `status` are updated (controls-card, page.tsx).

**Status:** done

---

### T2 — Health-check and stall detection in session-manager.ts (M)

**File:** `lib/session-manager.ts`

- Import `resolveTranscriptFile` from `lib/transcript-file-resolver.ts`.
- In `makeSessionInfo`: stat the resolved transcript file; populate `lastActivity`
  with `mtimeMs` (or `null` if no file). If the process is running and
  `Date.now() - lastActivity > 10 * 60 * 1000`, set `status: "stalled"`.
- In `spawnAndWatch`: add a second interval (`stallCheckInterval`, period 60 s) that
  runs alongside the exit-check interval. If stall is detected:
  1. Log to stderr: `[session-manager] stall detected for ${role} — restarting`.
  2. Kill the PID (SIGTERM, fallback SIGKILL after 10 s).
  3. After process exits, call `spawnAndWatch` again (mirrors the existing
     exit-restart path).
- `clearInterval(stallCheckInterval)` when `autoRestartEnabled` is cleared or
  process exits normally.

**Dependencies:** T1  
**Agent:** Dev (generic)  
**Test strategy:** unit tests in `lib/session-manager.test.ts` (new file):
- Mock `resolveTranscriptFile` to return a path with a controllable mtime.
- Assert `makeSessionInfo` returns `status: "stalled"` when mtime is >10 min old
  and process is running.
- Assert `makeSessionInfo` returns `status: "running"` when mtime is fresh.
- Assert `makeSessionInfo` returns `status: "stopped"` when no process.  
**Acceptance criteria:**
- Unit tests pass (`npx vitest run`).
- `getSessionStatus` returns `status: "stalled"` for a running-but-stale session.
- Stall auto-restart fires after stall is detected (integration smoke: manual test).

**Status:** done

---

### T3 — POST /api/projects/[id]/restart route (S)

**File:** `app/api/projects/[id]/restart/route.ts` (new)

```ts
// POST /api/projects/[id]/restart — stop then start the CTO session
import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { stopSession, startSession } from "@/lib/session-manager";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  await stopSession(project.path, "cto");
  const sessionInfo = await startSession(project.path, "cto");
  return NextResponse.json({ data: sessionInfo });
}
```

**Dependencies:** T1, T2  
**Agent:** Dev (generic)  
**Test strategy:** manual smoke test via curl; existing start/stop unit tests cover
the underlying functions.  
**Acceptance criteria:**
- `POST /api/projects/0/restart` returns 200 with new `sessionInfo`.
- Session restarts cleanly (old PID killed, new PID recorded).

**Status:** done

---

### T4 — Extend ControlsCard with stalled state (S)

**File:** `components/mission-control/controls-card.tsx`

- Add `stalled?: boolean` and `onRestart?: () => void` to `ControlsCardProps`.
- When `stalled` is true:
  - Change the outer `div`'s left border to `border-l-amber-500`.
  - Render a stall warning above the button row:
    ```
    ⚠ Session stalled — no output for 10 minutes
    ```
    (amber text, small, `text-amber-600 dark:text-amber-400`).
  - Add a Restart button (amber background) alongside or replacing Stop:
    ```tsx
    <button onClick={onRestart} className="flex-1 px-3 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition">
      Restart
    </button>
    ```
- When `stalled` is false/undefined, component renders exactly as before.

**Dependencies:** T1  
**Agent:** Dev (generic)  
**Test strategy:** render test — assert amber border class and warning text appear
when `stalled={true}`; assert they are absent when `stalled={false}`.  
**Acceptance criteria:**
- Storybook / vitest render test passes.
- Amber border and warning text visible in browser when session is stalled.
- Normal state unchanged.

**Status:** done

---

### T5 — Wire stalled prop into mission-control page (S)

**File:** `app/project/[id]/page.tsx`

- Derive `stalled` from `detail.project.sessionStatus.cto.status === "stalled"`.
- Pass `stalled={stalled}` and `onRestart={handleRestart}` to `<ControlsCard>`.
- Add `handleRestart`:
  ```ts
  async function handleRestart() {
    await fetch(`/api/projects/${id}/restart`, { method: "POST" });
    await fetchDetail();
  }
  ```

**Dependencies:** T3, T4  
**Agent:** Dev (generic)  
**Test strategy:** manual — verify amber card renders when API returns stalled
status. The 5 s polling loop will pick it up automatically.  
**Acceptance criteria:**
- When `cto.status === "stalled"`, ControlsCard shows amber state.
- Clicking Restart calls `/restart` and re-fetches detail.
- When session restarts, stalled state clears within one polling cycle.

**Status:** done

---

### T6 — Vitest unit tests for session-manager stall logic (M)

**File:** `lib/session-manager.test.ts` (new)

Cover:
1. `makeSessionInfo` with fresh mtime → `status: "running"`.
2. `makeSessionInfo` with stale mtime (>10 min) + process alive → `status: "stalled"`.
3. `makeSessionInfo` with no process → `status: "stopped"`.
4. `makeSessionInfo` with no transcript file → `lastActivity: null`, status not stalled.

Use `vi.mock` for `fs.statSync`, `resolveTranscriptFile`, and `isProcessRunning`.

**Dependencies:** T2  
**Agent:** Dev (generic)  
**Test strategy:** `npx vitest run lib/session-manager.test.ts`  
**Acceptance criteria:**
- All 4 cases pass.
- `npx vitest run` exits 0.

**Status:** done

---

## Execution Order

```
T1 → T2 → T6   (backend: types, logic, tests — sequential)
T1 → T4         (frontend: controls card — can run in parallel with T2)
T2 + T3 + T4 → T5  (wire-up: needs API route, card, and logic)
```

Optimal parallelism: after T1, T2 and T4 can proceed in parallel.
T3 can follow T2. T5 follows T3 and T4.

---

## Open Questions

None — defaults applied for all decisions.

---

## Out of Scope

- Distinguishing quota exhaustion vs. permission prompts (both treated as stall).
- Persisting stall history to state.json.
- Configurable stall timeout (10 minutes is hardcoded; can be made env-var later).
- Notification outside the dashboard (e.g., Telegram alert) — separate backlog item.
