# T085: WorkingOn Card — Phase Case Mismatch + Missing Task Title

## Problem

The WorkingOn card on the mission control page shows "Starting up — analyzing project..." even
when RedEye is mid-cycle (e.g. phase=build, task_id=T083).

Two root causes:

### Root Cause 1: Phase case mismatch

`state.json` stores phase values in lowercase (`"triage"`, `"plan"`, `"build"`, `"review"`,
`"deploy"`, `"verify"`, `"merge"`, `"stabilize"`, `"incorporate"`, `"schedules"`, `"harden"`).

`working-on-card.tsx` compares against UPPERCASE literals (`"HARDEN"`, `"STABILIZE"`,
`"TRIAGE"`, `"INCORPORATE"`, `"SCHEDULES"`). All lowercase phases fall through to the default
"Starting up — analyzing project..." string.

`PHASE_LABELS` and `PHASE_COLORS` in `lib/redeye-types.ts` are keyed UPPERCASE. `PhaseBadge`
already uses them via lookup (gracefully falls back), so the badge also shows the raw lowercase
value as the label when no uppercase match exists.

### Root Cause 2: Missing task_title in state.json

`state.json` has `task_id` but no `task_title` field. `hasTask = state?.task_title` is always
falsy, so even with a task active the component takes the "running && !hasTask" branch instead
of the rich title branch.

## Fix

### Sub-task 1: Normalize phase to uppercase (S)

In `working-on-card.tsx`:
- Add a `normalizePhase(p: string | undefined | null): string` helper that returns
  `(p ?? "").toUpperCase()`.
- Apply `normalizePhase(state.phase)` everywhere `state.phase` is compared against uppercase
  literals: lines 38, 44, 100-105, and the `PhaseBadge` call on line 108.
- Update all comparisons to use the normalized value.

Also update `PHASE_LABELS` and `PHASE_COLORS` to add lowercase aliases OR rely entirely on
normalization in the component. The normalization-in-component approach is preferred because it
is contained and does not widen the type surface.

Affects only: `components/mission-control/working-on-card.tsx`

### Sub-task 2: Surface active task title (S)

The parent component `mission-control-client.tsx` has `detail.activeItem` (a `TaskItem | null`)
which contains the task title. Pass it down to `WorkingOnCard` as a new optional prop
`activeTaskTitle?: string | null`.

- Update `WorkingOnCard` props interface: add `activeTaskTitle?: string | null`.
- Update `hasTask` derivation: `const hasTask = state?.task_title ?? activeTaskTitle;`
- When rendering the title, prefer `activeTaskTitle` as fallback when `state.task_title` is null:
  `{state!.task_title ?? activeTaskTitle}`
- In `mission-control-client.tsx`, pass `activeTaskTitle={detail?.activeItem?.title ?? null}`.

Affects: `components/mission-control/working-on-card.tsx`,
`app/project/[id]/mission-control-client.tsx`

### Sub-task 3: Tests (S)

Update/add tests in `working-on-card.test.tsx`:
- Add tests with lowercase phase values (`"build"`, `"review"`, `"triage"`, `"merge"`) to verify
  the correct message and badge color class is shown.
- Add a test passing `activeTaskTitle` prop but no `state.task_title` to verify the title branch
  is taken and the title text appears.
- Existing uppercase-phase tests must continue to pass.

## Acceptance Criteria

1. With `state.json` containing `phase: "build"`, `task_id: "T085"`, and no `task_title`, and
   `running=true`, the WorkingOn card shows "Building" badge (blue) — NOT "Starting up".
2. With `activeTaskTitle="My Feature"` passed from the parent, the full rich task row renders.
3. All existing tests pass, no new test failures.
4. Production build clean.
