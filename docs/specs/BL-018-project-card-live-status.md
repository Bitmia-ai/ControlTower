# BL-018: Project Cards on Home Page Don't Show Current Phase or Active Task

## Problem

The home page project cards always display "No active task" and render `PhaseBadge` with `phase={undefined}`, showing an "Idle" label regardless of whether a RedEye session is actively running.

**Root cause — two-part gap:**

1. **API layer:** `GET /api/projects` (route.ts) calls `listProjects()` and augments each project with only `initialized` and `running`. It never reads `.redeye/state.json`, so `phase` and `backlog_title` (currentTask) are absent from the response payload.

2. **Component layer:** `components/project-card.tsx` casts `project` to access `currentTask` via a local type assertion, and hard-codes `phase={undefined}` in the `<PhaseBadge>` call. Even if the API did return the data, the component would need to wire it up.

The single-project detail endpoint (`GET /api/projects/[id]`) already reads state correctly via `readProjectDetail` / `readState` from `lib/redeye-files.ts` — the fix is to reuse the same pattern in the list endpoint.

---

## Architecture Decisions

### AD-1: Extend `ProjectWithStatus` rather than creating a new type

`lib/redeye-types.ts` already defines `ProjectWithStatus`. Add optional fields `phase`, `currentTask`, and `health` to it. This avoids parallel type hierarchies and means the home page component already receives the right shape with no extra work.

### AD-2: Read `state.json` inside the list endpoint, not in the client

Calling `readState(project.path)` once per project on the server is cheap (one JSON file read, ~1ms). Delegating to the client would require extra per-project fetches. Consistent with the pattern used by the detail endpoint.

### AD-3: No new component — thread data through `ProjectCard` directly

`ProjectCard` already accepts `ProjectWithStatus`. It already reads `currentTask` via a cast. We replace the cast with a proper field on the type and remove the hard-coded `phase={undefined}`.

### AD-4: Graceful degradation when state.json is absent

Projects that are not initialized (no `.redeye/state.json`) should display "No active task" and an idle badge — the same as the current behavior. `readState` already returns `null` on missing files, so the fields simply remain `undefined`.

### AD-5: No new polling — home page already polls every 10 s

`app/page.tsx` already has `setInterval(fetchProjects, 10_000)`. The new state fields will update automatically on the next poll.

---

## Sub-tasks

### ST-1: Extend `ProjectWithStatus` type  
**Size:** S  
**File:** `lib/redeye-types.ts`  
**Dependencies:** none  
**Agent type:** Dev  

Add three optional fields to `ProjectWithStatus`:

```ts
phase?: Phase | null;
currentTask?: string | null;
health?: RedEyeState["health"] | null;
```

**Test strategy:** Type-only change; existing tests continue to compile. Confirm with `npx tsc --noEmit`.

**Acceptance criteria:**
- `ProjectWithStatus` compiles with the new optional fields
- No existing code broken (tsc clean)
- **Status:** pending

---

### ST-2: Read `state.json` in `GET /api/projects`  
**Size:** S  
**File:** `app/api/projects/route.ts`  
**Dependencies:** ST-1  
**Agent type:** Dev  

Import `readState` from `lib/redeye-files`. In the `Promise.all` map, call `readState(p.path)` alongside the existing `isInitialized` call. Spread `state.phase`, `state.backlog_title` (as `currentTask`), and `state.health` into the per-project object.

Example shape to return per project:
```ts
{
  ...p,
  initialized: ...,
  running: ...,
  phase: state?.phase ?? null,
  currentTask: state?.backlog_title ?? null,
  health: state?.health ?? null,
}
```

**Test strategy:** Unit test in `app/api/projects/route.test.ts` (or alongside existing tests). Mock `listProjects`, `isInitialized`, `getSessionStatus`, and `readState`. Assert that the returned JSON includes `phase` and `currentTask` from the mocked state. Assert that missing state produces `null` values.

**Acceptance criteria:**
- `GET /api/projects` response includes `phase`, `currentTask`, `health` per project
- Projects with no `state.json` return `null` for all three fields
- No performance regression (still resolves in parallel with `Promise.all`)
- **Status:** pending

---

### ST-3: Wire `phase` and `currentTask` into `ProjectCard`  
**Size:** S  
**File:** `components/project-card.tsx`  
**Dependencies:** ST-1, ST-2  
**Agent type:** Dev  

Replace the local type-cast for `currentTask` with direct access to the typed field from `project`. Replace `phase={undefined}` in the `<PhaseBadge>` call with `phase={project.phase ?? undefined}`.

Concrete diff:
- Remove the `(project as ProjectWithStatus & { currentTask?: ... }).currentTask` cast — use `project.currentTask` directly.
- Change `<PhaseBadge phase={undefined} running={project.running} />` to `<PhaseBadge phase={project.phase ?? undefined} running={project.running} />`.

**Test strategy:** Visual smoke test via Playwright: navigate to home page, verify that the haze project card shows the correct phase badge (e.g. "Building") and task title when a session is running, and shows idle/no-task when stopped.

**Acceptance criteria:**
- Phase badge reflects the actual current phase from `state.json`
- Current task title (backlog_title) is shown in the card body
- "No active task" shown when `currentTask` is null
- Idle badge shown when `phase` is null
- Existing card layout and delete/toggle buttons unchanged
- **Status:** pending

---

### ST-4: Write unit tests for the API extension  
**Size:** S  
**File:** `app/api/projects/route.test.ts` (new) or inline with ST-2  
**Dependencies:** ST-2  
**Agent type:** Dev  

Cover:
1. Happy path: `readState` returns a state object — response includes correct `phase` and `currentTask`.
2. Null path: `readState` returns `null` — response fields are `null`.
3. Error path: `readState` throws — handled gracefully (null fields, no 500).

**Test strategy:** Vitest unit test with mocked `lib/redeye-files` and `lib/projects` modules.

**Acceptance criteria:**
- All three cases covered and passing via `npx vitest run`
- **Status:** pending

---

## Out of Scope

- BL-017 (cost card grid layout) — separate bug, separate PR.
- BL-019 (cost invariant fix) — separate bug.
- Real-time push updates (SSE) for home page cards — the 10 s poll is sufficient for now.
