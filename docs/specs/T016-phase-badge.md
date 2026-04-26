# T016: Make phase badge more prominent and dynamic

**Status:** done
**Priority:** P1
**Type:** feature

---

## Problem

The phase badge (Planning, Building, Reviewing, etc.) on the Working On card is a plain gray pill
(`bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300`) with minimal size
(`px-2 py-0.5 text-xs`). It looks static and identical regardless of what phase the agent is in.
Nothing in the UI conveys that live work is happening right now.

---

## Architecture Decisions

### AD-1: Phase-to-color map in `lib/redeye-types.ts`

A new exported constant `PHASE_COLORS` maps each Phase value to a Tailwind color token
pair (background + text) appropriate for both light and dark modes:

| Phase       | Background                              | Text                                    | Rationale           |
|-------------|-----------------------------------------|-----------------------------------------|---------------------|
| TRIAGE      | `bg-gray-200 dark:bg-zinc-700`          | `text-gray-700 dark:text-zinc-200`      | Neutral             |
| PLAN        | `bg-blue-100 dark:bg-blue-900/50`       | `text-blue-700 dark:text-blue-300`      | Thinking/planning   |
| BUILD       | `bg-blue-100 dark:bg-blue-900/50`       | `text-blue-700 dark:text-blue-300`      | Active development  |
| REVIEW      | `bg-amber-100 dark:bg-amber-900/40`     | `text-amber-700 dark:text-amber-300`    | Caution — checking  |
| DEPLOY      | `bg-green-100 dark:bg-green-900/40`     | `text-green-700 dark:text-green-300`    | Go / shipping       |
| VERIFY      | `bg-green-100 dark:bg-green-900/40`     | `text-green-700 dark:text-green-300`    | Confirming success  |
| MERGE       | `bg-green-100 dark:bg-green-900/40`     | `text-green-700 dark:text-green-300`    | Completing cycle    |
| STABILIZE   | `bg-red-100 dark:bg-red-900/40`         | `text-red-700 dark:text-red-300`        | Alert / recovery    |
| HARDEN      | `bg-violet-100 dark:bg-violet-900/40`   | `text-violet-700 dark:text-violet-300`  | Quality work        |
| INCORPORATE | `bg-cyan-100 dark:bg-cyan-900/40`       | `text-cyan-700 dark:text-cyan-300`      | Feedback loop       |
| SCHEDULES   | `bg-gray-200 dark:bg-zinc-700`          | `text-gray-700 dark:text-zinc-200`      | Maintenance         |

A fallback `default` key (`bg-gray-100 dark:bg-zinc-800` / `text-gray-700 dark:text-zinc-300`)
handles unknown phases. Keeping the map in `redeye-types.ts` alongside `PHASE_LABELS` ensures a
single source of truth for all phase metadata.

### AD-2: Shimmer animation — CSS class already present in globals.css

`@keyframes shimmer` and `.phase-badge-shimmer` already exist in `app/globals.css`.
The shimmer uses `background-size: 200% 100%` and `animation: shimmer 2s ease-in-out infinite`.
The badge receives this class only when `running === true`.

### AD-3: Larger, bolder badge

Upgrade from `px-2 py-0.5 text-xs font-medium rounded` to
`px-3 py-1 text-xs font-semibold rounded-md`. The increase makes the badge legible at a glance
without competing with the task title.

### AD-4: Animated dot indicator when active

Prepend a small animated dot (`h-1.5 w-1.5 rounded-full animate-pulse`) inside the badge when
`running === true`. This reinforces activity at a glance independently of color.

### AD-5: Local `PhaseBadge` helper — no new file

The phase badge appears in exactly two places inside `working-on-card.tsx`. Both are replaced
with calls to a `PhaseBadge` local function defined at the top of the file. The component is too
small to justify a separate file; co-location keeps the diff minimal.

### AD-6: Tailwind v4 safelist — literal class strings only

Tailwind v4 uses static extraction. Dynamic construction like `` `bg-${color}-100` `` is invisible
to the scanner. `PHASE_COLORS` values must be complete, literal Tailwind class strings — no
string interpolation.

---

## Sub-Tasks

### T1 — Add `PHASE_COLORS` to `lib/redeye-types.ts` [S]
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Description:** Export `PHASE_COLORS: Record<string, { bg: string; text: string }>` with
  full literal Tailwind class strings for all 11 phases plus a `default` fallback key.
- **Test strategy:** Unit test: import `PHASE_COLORS`, assert BUILD maps to blue classes and
  STABILIZE to red classes. Confirm no string interpolation present in values.
- **Acceptance criteria:**
  - 11 phase keys plus `default` all present
  - Every value contains only plain literal Tailwind class tokens
  - `npx vitest run` still passes
- **Status:** done

### T2 — Update `working-on-card.tsx` with dynamic animated badge [S]
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Description:**
  1. Define a `PhaseBadge` local helper accepting `(phase: string | null, running: boolean)`.
  2. Renders a pill using `PHASE_COLORS[phase] ?? PHASE_COLORS.default`, with an animated dot
     and `.phase-badge-shimmer` class when `running === true`.
  3. Replace both existing badge `<span>` elements (~line 41 and ~line 70) with `<PhaseBadge>`.
  4. Apply `px-3 py-1 font-semibold rounded-md` per AD-3.
- **Test strategy:** React Testing Library render test: mount `WorkingOnCard` with
  `running=true, state.phase="BUILD"` — assert blue classes and shimmer class present.
  Mount with `running=false` — assert no shimmer class and no animated dot.
- **Acceptance criteria:**
  - BUILD badge has blue background class
  - REVIEW badge has amber background class
  - DEPLOY badge has green background class
  - STABILIZE badge has red background class
  - Animated dot present only when `running === true`
  - `.phase-badge-shimmer` class present only when `running === true`
  - Both badge locations in the card updated
  - No layout regressions
- **Status:** done

### T3 — Verify `globals.css` shimmer correctness [S]
- **Dependencies:** none (parallel with T1)
- **Agent:** Dev (generic)
- **Description:** Confirm `@keyframes shimmer` and `.phase-badge-shimmer` in `app/globals.css`
  produce a valid gradient sweep. Keyframes already exist; verify `background-position` sweep
  (`-200% 0` to `200% 0`) works correctly when a gradient `background-image` is applied on the
  badge. If a gradient overlay is required for the effect, add it to the CSS class (not as an
  inline style) to keep the component clean.
- **Test strategy:** `npm run build` passes without CSS errors.
- **Acceptance criteria:**
  - `@keyframes shimmer` and `.phase-badge-shimmer` are correct
  - `npm run build` exits 0
- **Status:** done

### T4 — Build verification [S]
- **Dependencies:** T1, T2, T3
- **Agent:** Dev (generic) / QA
- **Description:** Run `npm run build` and `npx vitest run` and confirm all pass.
- **Test strategy:** CLI exit codes.
- **Acceptance criteria:**
  - `npm run build` exits 0
  - `npx vitest run` exits 0
  - Zero TypeScript errors
- **Status:** done

---

## Out of Scope (This Iteration)

- Phase badge in controls card, backlog page, or history tab
- Per-phase icons or emoji
- Storybook or isolated component demo

---

## Questions Posted

None — sufficient context to proceed with defaults.
