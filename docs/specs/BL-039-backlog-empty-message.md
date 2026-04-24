# BL-039: Show Clear "Backlog Empty" Stopped Message Instead of Idle

## Overview

When RedEye stops because the backlog has no more planned/pending tasks (i.e. it naturally exits after HARDEN), the UI shows a generic "Idle" label or nothing meaningful. The CEO wants a contextual message: "RedEye stopped — backlog empty. Add tasks to resume." This replaces the generic idle state in that specific condition.

## Background

### Current "Idle" display path

**Home page** (`components/project-card.tsx` → `components/phase-badge.tsx`):
- `PhaseBadge` renders the `phase` prop. When `phase` is undefined/null, it falls back to the label `"Idle"`.
- The home page API (`app/api/projects/route.ts`) passes `state?.phase` — when session is stopped this is whatever phase the CTO was in when it exited (e.g. `"HARDEN"`, `"TRIAGE"`).
- So the home card currently shows the last-known phase label (e.g. "Improving") while not running, which is also not great but somewhat informative.

**Mission control Working On card** (`components/mission-control/working-on-card.tsx`):
- When `!running && !hasTask` renders: grey dot + "RedEye is idle".
- This is the most prominent "Idle" message the CEO sees.

### How "backlog empty stop" is detected

RedEye enters the `HARDEN` phase when the backlog has no planned/pending/in-progress items. After HARDEN completes (and the backlog still has no items), the CTO session exits. The resulting UI state is:
- `running = false`
- `state.phase = "HARDEN"` (last phase before stopping)
- No planned/pending/in-progress backlog items

This combination is a reliable signal: session stopped after HARDEN with an empty actionable backlog. It is distinct from:
- User-triggered Stop (can happen at any phase with items remaining)
- User-triggered Pause (session is still "running" in terms of having a directive pending)
- Stalled session (`running = true`, `stalled = true`)

### Where to display

Display the contextual message in **both** places the "Idle" state appears:
1. **WorkingOnCard** (mission control) — prominent idle label → replace with backlog-empty message
2. **PhaseBadge** (home page project card) — subtle phase label → replace "Idle" with "Backlog empty" label when condition is met

## Architecture Decisions

### AD-1: Detect the condition client-side, not server-side

The detection logic (`!running && phase === "HARDEN" && no actionable backlog items`) requires data already available in the UI: `running`, `state.phase`, and `upNext` count (from `ProjectDetail`). No new API endpoint or state.json field is needed. This keeps the change minimal and avoids server-side write complexity.

### AD-2: Use `phase === "HARDEN"` as the primary signal, not a new `stop_reason` field

Adding a `stop_reason` to state.json would require the RedEye plugin to write it — a cross-repo change. The simpler heuristic (`!running && phase === "HARDEN"`) reliably identifies the backlog-empty stop scenario. Edge case: user manually stops during HARDEN with items remaining — this is rare and a slightly over-eager message in that case is acceptable.

For the home page, we don't have `upNext` counts available without adding them to the projects list API. The home card will use `!running && phase === "HARDEN"` alone (simpler, same reasoning as above).

### AD-3: Messaging

- WorkingOnCard: "RedEye stopped — backlog empty. Add tasks to resume."
- PhaseBadge (home card): label "Backlog empty" instead of "Idle"

This matches the CEO's requested copy exactly. The home card message is abbreviated to fit the badge space.

### AD-4: Visual treatment

- WorkingOnCard: amber/orange color (distinct from green=running, red=stopped-by-user) — use `text-amber-600 dark:text-amber-400`. Dot color: amber.
- PhaseBadge on home card: existing pill style, but with amber coloring similar to HARDEN's amber color to signal "needs attention."

### AD-5: Scope — no new API surface needed

All changes are confined to UI components and the home page API enrichment (to pass `phase` when stopped). The `phase` field is already returned by `GET /api/projects`.

## Sub-tasks

### T1: WorkingOnCard — detect and display backlog-empty message
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/mission-control/working-on-card.tsx`
- **Logic:**
  - Add `upNextCount?: number` prop to `WorkingOnCardProps`
  - Add a helper: `const isBacklogEmpty = !running && state?.phase === "HARDEN" && (upNextCount ?? 0) === 0`
  - In the `!running && !hasTask` branch, check `isBacklogEmpty`:
    - If true: render amber dot + "RedEye stopped — backlog empty." + secondary text "Add tasks to resume."
    - If false: existing "RedEye is idle" render unchanged
  - Wire `upNextCount` from the mission control page (`detail?.upNext?.length ?? 0`)
- **Test strategy:** Unit test in `working-on-card.test.tsx` — render with `running=false`, `state.phase="HARDEN"`, `upNextCount=0` → assert message appears; render with `upNextCount=1` → assert "idle" appears; render with `phase="BUILD"` → assert "idle" appears
- **Acceptance criteria:**
  - "RedEye stopped — backlog empty." visible when `!running && phase === "HARDEN" && upNextCount === 0`
  - Standard "idle" shown when any condition is false
  - Amber dot and text coloring
  - Existing "idle" path unchanged for all other stopped states
- **Status:** done

### T2: PhaseBadge (home page) — "Backlog empty" label when stopped after HARDEN
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/phase-badge.tsx`
- **Logic:**
  - Add `backlogEmpty?: boolean` prop to `PhaseBadge`
  - When `!running && backlogEmpty`: render label "Backlog empty" with amber dot (`bg-amber-500`) instead of grey
  - Default behavior unchanged (no `backlogEmpty` prop → existing behavior)
- **Wire-up** in `components/project-card.tsx`:
  - Add `backlogEmpty?: boolean` to `ProjectCardProps` / derive from props: `const backlogEmpty = !project.running && project.phase === "HARDEN"`
  - Pass `backlogEmpty` to `<PhaseBadge />`
- **Wire-up** in `app/api/projects/route.ts`:
  - `phase` is already returned from `state?.phase` — no API changes needed. `"HARDEN"` will be correctly passed through when that was the last phase.
- **Test strategy:** Update `project-card.test.tsx` — render with `running=false`, `phase="HARDEN"` → assert "Backlog empty" label renders; render with `running=false`, `phase="BUILD"` → assert "BUILD" label (not "Backlog empty"); render with `running=true`, `phase="HARDEN"` → assert running state (not backlog empty)
- **Acceptance criteria:**
  - Home card shows "Backlog empty" label with amber dot when `!running && phase === "HARDEN"`
  - Other stopped states show phase label or "Idle" unchanged
  - Running HARDEN phase shows animated green dot + "Improving" unchanged
- **Status:** done

### T3: Wire `upNextCount` into WorkingOnCard from mission control page
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/page.tsx`
- **Logic:**
  - Pass `upNextCount={detail?.upNext?.length ?? 0}` to `<WorkingOnCard />`
- **Acceptance criteria:**
  - WorkingOnCard receives correct count on every poll cycle
  - Count is 0 when backlog is empty, >0 when tasks remain
- **Status:** done

### T4: Unit tests
- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (generic)
- **Files:**
  - `components/mission-control/working-on-card.test.tsx` — add 3 cases (backlog-empty, idle, running-harden)
  - `components/project-card.test.tsx` — add 2 cases (backlog-empty label, stopped-not-harden label)
- **Test strategy:** vitest + React Testing Library. Assert rendered text and dot color classes.
- **Acceptance criteria:**
  - All new tests pass
  - `npx vitest run` green (full suite)
- **Status:** done

### T5: E2E verification with Playwright
- **Size:** S
- **Dependencies:** T1, T2, T3
- **Agent:** Dev (generic)
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Ensure the haze project session is stopped and `state.phase` is "HARDEN" (or manually set it)
  2. Navigate to home page → verify project card shows "Backlog empty" label with amber dot
  3. Navigate to mission control → verify WorkingOnCard shows "RedEye stopped — backlog empty. Add tasks to resume."
  4. Screenshot for record
  5. With a task present in backlog (planned), verify regular "idle" message shows instead
- **Note:** This is not an automated test file — Playwright MCP is used interactively at VERIFY time.
- **Acceptance criteria:** All 5 steps pass visually
- **Status:** pending

## Files Touched

| File | Change |
|------|--------|
| `components/mission-control/working-on-card.tsx` | Add `upNextCount` prop; detect + render backlog-empty message |
| `components/mission-control/working-on-card.test.tsx` | New test cases for backlog-empty condition |
| `components/phase-badge.tsx` | Add `backlogEmpty` prop; render "Backlog empty" label with amber dot |
| `components/project-card.tsx` | Derive `backlogEmpty` from props; pass to `PhaseBadge` |
| `components/project-card.test.tsx` | New test cases for backlog-empty label |
| `app/project/[id]/page.tsx` | Pass `upNextCount` to WorkingOnCard |

## No Changes Required

- `app/api/projects/route.ts` — `phase` already returned; no new fields needed
- `lib/redeye-files.ts` / `lib/redeye-parsers.ts` — no new parsing needed
- `lib/redeye-types.ts` — no new types needed (detecting condition from existing fields)
- `lib/session-manager.ts` — no changes
- `app/api/projects/[id]/route.ts` — `upNext` already computed in `readProjectDetail()`

## Test Strategy Summary

- Unit tests (vitest): T4 adds ~5 targeted test cases across 2 existing test files. Full suite must remain green.
- E2E: Playwright MCP at VERIFY time (T5).
- No new test files needed — extending existing test files is sufficient.

## Questions Posted

None. Detection heuristic is clear, copy is CEO-specified, visual treatment is straightforward.
