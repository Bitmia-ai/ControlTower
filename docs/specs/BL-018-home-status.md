# BL-018 — Project cards on home page don't show current phase or active task

**Status:** done  
**Priority:** P2  
**Type:** bug  
**Spec author:** VP Engineering (iteration 33)

---

## Problem

`ProjectCard` renders `<PhaseBadge phase={undefined} running={project.running} />` and uses `project.currentTask` for the task line. However, `GET /api/projects` never reads `state.json`, so `phase` and `currentTask` are never set. The card always shows "Idle / No active task" even when a RedEye session is running.

---

## Root cause

`app/api/projects/route.ts` enriches each project with `initialized` and `running` (from `getSessionStatus`) but never calls `readState`. `ProjectWithStatus` in `redeye-types.ts` has no `phase` or `currentTask` fields, so even if the API returned them, TypeScript would not accept them — the component already does an unsafe cast to read `currentTask`.

---

## Architecture decisions

1. **Extend `ProjectWithStatus` in `lib/redeye-types.ts`** — add optional `phase?: string` and `currentTask?: string | null`. This is the canonical data contract; other consumers (`ProjectCard`, the API route) depend on it.

2. **Enrich in the projects list API** — `GET /api/projects/route.ts` already calls `readState` indirectly (via `isInitialized`) for each project. We add a parallel `readState(p.path)` call per project (reusing the existing `readState` function from `lib/redeye-files.ts`). Cost: one JSON read per project per page load — acceptable for a dashboard that lists O(10) projects.

3. **No separate caching layer** — projects list is already fetched on demand, not hot-path performance critical. Simple `readState` per project is fine.

4. **Remove the unsafe cast in `ProjectCard`** — `currentTask` is now a typed field on `ProjectWithStatus`, so the cast `(project as ProjectWithStatus & { currentTask?: ... })` can be deleted.

5. **Pass `phase` down to `PhaseBadge`** — `PhaseBadge` already handles `phase={undefined}` (shows "Idle"), so no API changes needed in that component. When `phase` is set and `running` is true, the existing shimmer animation from BL-016 activates automatically.

6. **Guard against uninitialized projects** — if `state.json` is absent (project not initialized), `readState` returns `null`; `phase` and `currentTask` should remain `undefined`/`null`.

---

## Sub-task decomposition

### T1 — Extend `ProjectWithStatus` type
- **Size:** S
- **File:** `lib/redeye-types.ts`
- **Change:** Add `phase?: string` and `currentTask?: string | null` to `ProjectWithStatus`.
- **Dependencies:** none
- **Agent type:** Dev (generic)
- **Test strategy:** TypeScript compile check; existing `lib/projects.test.ts` should still pass.
- **Acceptance criteria:**
  - `ProjectWithStatus` has `phase?: string` and `currentTask?: string | null` fields.
  - No TypeScript errors.
- **Status:** done

### T2 — Enrich projects list API with state data
- **Size:** S
- **File:** `app/api/projects/route.ts`
- **Change:**
  - Import `readState` from `@/lib/redeye-files`.
  - In the `Promise.all` map, call `readState(p.path)` alongside `isInitialized`.
  - Derive `phase: state?.phase` and `currentTask: state?.backlog_title ? \`${state.backlog_item ?? ""} ${state.backlog_title}\`.trim() : null` — matching the same logic in `readProjectDetail`.
  - Return both fields in the enriched object.
- **Dependencies:** T1
- **Agent type:** Dev (generic)
- **Test strategy:** Unit test in `app/api/projects/route.test.ts` (new file) mocking `readState` — assert that when `readState` returns a state with `phase: "BUILD"` and `backlog_title: "My task"`, the API response includes those fields.
- **Acceptance criteria:**
  - When a project has an active state.json with `phase` and `backlog_title`, the API response includes `phase` and `currentTask`.
  - When `state.json` is missing or project is not initialized, `phase` is `undefined` and `currentTask` is `null`.
  - Existing `initialized` and `running` fields are unaffected.
- **Status:** done

### T3 — Update `ProjectCard` to use typed fields
- **Size:** S
- **File:** `components/project-card.tsx`
- **Change:**
  - Remove the unsafe cast for `currentTask` — use `project.currentTask` directly.
  - Pass `phase={project.phase}` to `<PhaseBadge>`.
- **Dependencies:** T1, T2
- **Agent type:** Dev (generic)
- **Test strategy:** Visual — Playwright screenshot of home page with a running project verifies phase label and task text appear. TypeScript compile confirms no cast errors.
- **Acceptance criteria:**
  - `PhaseBadge` receives the real phase string when available.
  - Task line shows `backlog_item + backlog_title` when active, or "No active task" when null.
  - No TypeScript `as` cast needed for `currentTask`.
- **Status:** done

### T4 — Playwright smoke test
- **Size:** S
- **File:** `e2e/home-project-status.spec.ts` (new, or extend existing smoke test)
- **Change:** Screenshot home page; assert at least one project card does not show "Idle" when session is active (or assert card renders without error when session is stopped).
- **Dependencies:** T1, T2, T3
- **Agent type:** QA Lead
- **Test strategy:** Playwright against `http://localhost:3200`. The haze project is always present; when stopped it should show "Idle / No active task"; this verifies the null path.
- **Acceptance criteria:**
  - Home page loads without console errors.
  - Project card renders phase badge and task line correctly for both running and stopped states.
- **Status:** done

---

## Data flow (after fix)

```
GET /api/projects
  → listProjects()              (reads ~/.redeye/config.json)
  → per project in parallel:
      isInitialized(p.path)     (checks .redeye/state.json exists)
      getSessionStatus(p.path)  (checks pid file)
      readState(p.path)         (reads .redeye/state.json)
  → returns ProjectWithStatus[] with phase, currentTask, running, initialized

ProjectCard
  → <PhaseBadge phase={project.phase} running={project.running} />
  → {project.currentTask ?? "No active task"}
```

---

## Risk and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `readState` throws on malformed JSON | Low | `readState` already returns `null` on parse error |
| Performance regression from extra fs read | Low | One JSON read per project, sub-millisecond on local disk |
| `currentTask` format differs from mission control | None | Same derivation logic as `readProjectDetail` |

---

## Out of scope

- Auto-refresh / polling of the home page (separate feature).
- Showing iteration count or cost on the card.
- BL-017 (cost card grid layout) — separate item.
