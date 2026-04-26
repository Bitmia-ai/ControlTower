# T023 — Home Page Auto-Refresh Polling

**Status:** planned  
**Priority:** P2  
**Type:** feature  
**Iteration:** 62

---

## Context and Discovery

The backlog item was written in iteration 37 (HARDEN phase) and described the home page as a
server component with no polling. That description is **no longer accurate**.

As of the current codebase, `app/page.tsx` is already a `'use client'` component that:

- Fetches `/api/projects` on mount via `fetchProjects` (a `useCallback`).
- Polls every **10 seconds** with `setInterval(fetchProjects, 10_000)` inside `useEffect`.
- Cleans up the interval on unmount via the effect's return function.
- Suppresses error toasts during polling (errors only surface on initial empty-state load).

The core requirement — 10 s polling so project cards update phase/task in real time — is
**already implemented and shipped**.

---

## Current Data Flow

```
Browser (app/page.tsx — 'use client')
  ↓  fetch /api/projects  (on mount + every 10 s)
app/api/projects/route.ts  GET
  ↓  listProjects()           → projects.json (name, path)
  ↓  isInitialized(p.path)   → .redeye/state.json existence
  ↓  readState(p.path)        → phase, backlog_item, backlog_title
  ↓  readInbox(p.path)        → pending question count
  ↓  getSessionStatus(p.path) → running / stalled
  → ProjectWithStatus[]  { name, path, initialized, running, phase, currentTask, questionCount }
  ↓
ProjectCard renders:
  - project name + question badge
  - currentTask (or "No active task")
  - PhaseBadge (phase + running flag)
  - initialized dot indicator
  - Start / Stop button
```

Fields that change while a session is active: `running`, `phase`, `currentTask`,
`questionCount`. All are refreshed on every 10 s tick.

---

## Gap Analysis — What Is Missing

The original backlog description listed one enhancement not yet implemented:

> **Pause polling when the tab is hidden; on refocus immediately re-fetch then resume interval.**

The current implementation does **not** use `document.visibilityState` or listen to
`visibilitychange`. When the tab is hidden the interval continues to fire, making unnecessary
network requests.

This is the only remaining gap.

---

## Architecture Decision

The home page is already a client component. No new wrapper or architectural change is needed.
The fix is entirely additive: augment the existing `useEffect` (or add a second small effect)
to:

1. Listen for `visibilitychange` on `document`.
2. When tab becomes hidden: do nothing (interval still fires but fetches are cheap; see
   alternative below).
3. When tab becomes visible: call `fetchProjects()` immediately, then let the next interval
   tick happen naturally.

Alternative — pause the interval entirely when hidden, restart on visible. This is slightly
more complex but eliminates all hidden-tab requests. **Adopt this approach** (matches the
original spec intent and the pattern used in many dashboards):

```
useEffect(() => {
  fetchProjects();

  let interval = setInterval(fetchProjects, POLL_INTERVAL_MS);

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      clearInterval(interval);
    } else {
      fetchProjects();                          // immediate re-fetch on focus
      interval = setInterval(fetchProjects, POLL_INTERVAL_MS);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [fetchProjects]);
```

Note: `fetchProjects` is a `useCallback` gated on `projects.length`. The dependency array
on the effect means the effect re-runs whenever `fetchProjects` changes (i.e. when
`projects.length` crosses zero). This is intentional — it preserves the existing error-only-
on-empty behavior while keeping the polling live. No change to `useCallback` deps is required.

---

## Sub-Tasks

### T1 — Visibility-aware polling in `app/page.tsx`
- **Size:** S
- **Agent:** Dev (generic / sonnet)
- **Dependencies:** none
- **Files touched:** `app/page.tsx`
- **Change:** Replace the single `setInterval` in the polling `useEffect` with the
  pause-on-hidden / resume-on-visible pattern described above. Keep `POLL_INTERVAL_MS = 10_000`
  constant at the top of the component (or extract to a named constant).
- **Test strategy:** Unit test via vitest + jsdom: simulate `visibilitychange` events and
  assert that `fetch` is called on focus and not called while hidden.
- **Acceptance criteria:**
  - Interval fires every 10 s when tab is visible.
  - Interval is cleared when `visibilitychange` fires with `document.hidden === true`.
  - `fetchProjects` is called immediately when tab becomes visible again.
  - Cleanup removes both the interval and the event listener on unmount.
- **Status:** done

### T2 — Unit tests for visibility polling behaviour
- **Size:** S
- **Agent:** Dev (generic / sonnet)
- **Dependencies:** T1
- **Files touched:** `app/page.test.tsx` (new) or `app/page.polling.test.tsx`
- **Test strategy:** vitest + jsdom; mock `fetch` to resolve with `{ data: [] }`; use
  `vi.useFakeTimers()` to advance clock; dispatch synthetic `visibilitychange` events on
  `document`; assert call count.
- **Acceptance criteria:**
  - Test: initial mount triggers one fetch.
  - Test: advancing clock 10 s triggers a second fetch.
  - Test: hiding tab clears interval — advancing clock 20 s does NOT trigger additional fetches.
  - Test: showing tab triggers immediate fetch and resumes interval.
  - All existing tests continue to pass (`npx vitest run` green).
- **Status:** done

### T3 — Smoke verify with Playwright
- **Size:** S
- **Agent:** QA Lead / sonnet (via Playwright MCP)
- **Dependencies:** T1, T2
- **Files touched:** none (verification only)
- **Test strategy:** Open http://localhost:3200; confirm home page loads with project cards;
  switch to a background tab for 15 s and switch back; confirm cards reflect current state
  (no stale spinner); take screenshot.
- **Acceptance criteria:**
  - Home page renders project cards on load.
  - After tab-switch-and-return the cards show up-to-date phase/task data.
  - Browser console shows no errors related to the polling code.
- **Status:** pending

---

## Files Touched

| File | Change |
|------|--------|
| `app/page.tsx` | Add visibility-aware polling (T1) |
| `app/page.test.tsx` (new) | Unit tests for polling behaviour (T2) |

No API, library, or component files require changes.

---

## Acceptance Criteria (Feature Level)

1. Home page project cards refresh automatically every 10 s when the browser tab is visible.
2. When the tab is hidden, polling pauses (no network requests fired).
3. When the tab becomes visible again, a fetch fires immediately, then polling resumes at the
   10 s interval.
4. All existing unit tests pass (`npx vitest run` green).
5. Playwright smoke confirms cards load and remain current after tab switching.

---

## Questions

None. No CEO input is needed — the approach is fully determined by the existing codebase
pattern and the original spec intent.

---

## Notes

- The mission control page (`app/project/[id]/page.tsx`) polls every **5 s** (faster because
  it drives live session telemetry). Home page keeps **10 s** — appropriate for a summary view.
- The `fetchProjects` `useCallback` dependency on `projects.length` is a pre-existing pattern.
  Do not change it during this task to avoid unintended behaviour changes.
- `document.visibilityState` and `visibilitychange` are universally supported in all modern
  browsers (no polyfill needed).
