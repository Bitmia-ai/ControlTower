# BL-052: Add Keyboard Shortcuts for Common Actions (Start, Stop, Backlog Navigation)

## Overview

Power users have no keyboard shortcuts for frequent mission-control actions. This feature adds a
global keydown hook that maps 5 single-key shortcuts to Start, Stop, Pause, Add to Backlog, and
navigation actions (Backlog page, History page, Live tab). Keyboard hint labels are added to
relevant buttons in the ControlsCard and navigation. No new npm dependencies.

---

## Architecture Decisions

### AD-1: Global keydown listener in a dedicated hook `lib/use-keyboard-shortcuts.ts`

The hook follows the `usePhaseChangeNotifier` / `useTaskTransitionTracker` pattern already
established in this codebase:

- Lives in `lib/` with no framework coupling beyond React.
- Accepts a `ShortcutConfig` map (key → callback) and a boolean `enabled` flag.
- Attaches a single `document.addEventListener("keydown", handler)` on mount and removes it on
  unmount via `useEffect` cleanup.
- Callbacks are held in refs to avoid stale closures — same pattern as existing hooks.

This isolates the keydown logic for unit testing with `renderHook` and `fireEvent.keyDown` without
any need to render the full page component.

### AD-2: Shortcuts are suppressed when a text input is focused or a modal/dialog is open

The handler checks:
1. `event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement` →
   bail out. Prevents key presses from firing actions while the user types in the Steer or Add
   Backlog dialog inputs.
2. `event.target instanceof HTMLElement && event.target.closest('[role="dialog"]')` → bail out.
   Catches modal dialogs (AnswerModal, SteerDialog, AddBacklogDialog) even when the focused
   element is a non-input (e.g. a button inside the dialog).
3. `event.metaKey || event.ctrlKey || event.altKey` → bail out. Avoids clashing with browser or
   OS shortcuts that use modifier keys.

### AD-3: Shortcut keys and their actions

| Key | Label hint | Action | Condition |
|-----|------------|--------|-----------|
| `s` | `S` | Start session | `!running` (noop if running) |
| `x` | `X` | Graceful Stop | `running` (noop if idle) |
| `p` | `P` | Pause | `running` (noop if idle) |
| `b` | `B` | Add to Backlog (open dialog) | always |
| `g` then `b` | `GB` | Navigate to Backlog page | always (chord, see AD-4) |
| `g` then `h` | `GH` | Navigate to History page | always (chord, see AD-4) |
| `g` then `l` | `GL` | Navigate to Live tab | always (chord, see AD-4) |

`s`, `x`, `p`, `b` are single-key shortcuts wired directly in the hook.
Navigation chords (`g` + second key) are handled via a 500 ms chord window (see AD-4).

**Rationale for `x` (not `s`) for Stop:** `s` already means Start when idle. Using `x` for Stop
avoids the need to track running/idle state inside the key dispatcher; instead each callback is
gated by the `running` prop passed at call site.

**Rationale for `b` opening Add to Backlog dialog rather than navigating:** The backlog navigation
is handled via the `g` + `b` chord to avoid ambiguity. Power users can use `g` + `b` to navigate
and `b` alone to quickly add a task.

### AD-4: Navigation uses a `g`-prefix chord (vim-style "go to")

Two-key chords via a 500 ms window: pressing `g` arms the hook into "chord mode"; a second key
(`b`, `h`, or `l`) within 500 ms triggers navigation. If no second key arrives within 500 ms, or
if the second key is unrecognised, chord mode is cancelled silently.

Navigation is performed via `window.location.href` assignment rather than `useRouter().push()`
because:
- The mission control page uses `"use client"` already, but `useRouter` is a React hook that
  cannot be passed into a pure-lib hook without coupling the lib to Next.js internals.
- `window.location.href` works correctly in the browser context and produces a full page
  navigation — acceptable for these infrequent nav actions.
- The hook accepts a `navigate: (path: string) => void` callback so callers (including tests)
  can inject their own navigator, keeping the hook testable without `jsdom` window hacks.

### AD-5: Keyboard hint labels on buttons in ControlsCard

Add small `<kbd>` hint badges to the primary control buttons in `ControlsCard`:
- Start button: `S` badge (shown only when `!running`)
- Stop button: `X` badge (shown only when `running`)
- Pause button: `P` badge (shown only when `running`)
- "Add to Backlog" button: `B` badge (always shown)

The badge is a `<kbd>` element styled with Tailwind:
`ml-1.5 text-[10px] leading-none font-mono px-1 py-0.5 rounded border border-current opacity-50`
It does not affect button accessible names (the `aria-label` already covers the full action).

Navigation hint labels (GB, GH, GL) are added to the tab nav items in the project layout
(`app/project/[id]/layout.tsx`) as the same `<kbd>` style.

### AD-6: Hook is wired into `app/project/[id]/page.tsx`

`useKeyboardShortcuts` is called in the existing `ProjectPage` component (already `"use client"`).
It receives:
- `running` — current running state (already tracked as `const running = detail?.project?.running ?? false`)
- `onStart`, `onStop`, `onPause` — already-defined `handleAction` variants
- `onAddBacklog` — already-defined `() => setBacklogOpen(true)`
- `navigate` — `(path) => { window.location.href = path }` inline
- `projectId` — used to construct nav paths

No structural changes to the page component; only a new hook call is added.

### AD-7: No new npm dependencies

All implementation uses:
- React (already present): `useEffect`, `useRef`, `useCallback`
- Tailwind CSS (already present): `<kbd>` badge styling
- Browser native `KeyboardEvent` (no polyfill)

---

## Sub-task Decomposition

### T1 — `lib/use-keyboard-shortcuts.ts` (new hook)

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** none
**Description:**

Create `useKeyboardShortcuts(config: KeyboardShortcutConfig)` where:

```ts
interface KeyboardShortcutConfig {
  enabled: boolean;
  onStart?: () => void;      // fires when key "s" pressed and running === false
  onStop?: () => void;       // fires when key "x" pressed and running === true
  onPause?: () => void;      // fires when key "p" pressed and running === true
  onAddBacklog?: () => void; // fires when key "b" pressed (always)
  navigate?: (path: string) => void; // fires for g-prefix chords
  running: boolean;
  projectId: number;
}
```

Implementation:
- `useEffect` registers `document.addEventListener("keydown", handler)`, cleans up on unmount.
- `handler` checks suppression conditions (AD-2) before dispatching.
- Single-key dispatches: `s`, `x`, `p`, `b` map to their respective callbacks, gated by
  `running` where appropriate.
- Chord mode: pressing `g` sets a `chordPendingRef` and arms a 500 ms `clearTimeout`. A
  subsequent `b`/`h`/`l` within the window fires `navigate()` with the correct path.
  Chord mode is cancelled on any unrecognised key or timeout.
- All callbacks held in refs to prevent stale closure bugs.

**Test strategy:** Unit tests in `lib/use-keyboard-shortcuts.test.ts` using `renderHook` and
`fireEvent.keyDown(document, { key: "s" })`:
- `s` fires `onStart` when `running=false`, does NOT fire when `running=true`.
- `x` fires `onStop` when `running=true`, does NOT fire when `running=false`.
- `p` fires `onPause` when `running=true`, does NOT fire when `running=false`.
- `b` fires `onAddBacklog` regardless of `running`.
- `g`+`b` calls `navigate` with backlog path.
- `g`+`h` calls `navigate` with history path.
- `g`+`l` calls `navigate` with live path.
- `g` alone (no follow-up within 500 ms) does NOT call `navigate`.
- Suppressed when `event.target` is an `<input>`.
- Suppressed when `event.target` is inside a `[role="dialog"]` element.
- Suppressed when `event.metaKey` is true.
- `enabled=false` suppresses all shortcuts.
- Callbacks are read from refs — stale closure test: swap callback before key press, only
  latest callback fires.

**Acceptance criteria:**
- [ ] Hook exported from `lib/use-keyboard-shortcuts.ts`
- [ ] 12+ unit tests, all passing
- [ ] TypeScript strict — no `any`
- [x] Chord timeout cleared on unmount (no memory leaks)

**Status:** done

---

### T2 — Keyboard hint badges in `ControlsCard`

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** T1 (logically — badge visibility should match when shortcuts are live)
**Description:**

Add `<kbd>` hint badges to the primary buttons in `components/mission-control/controls-card.tsx`:
- Start button: `<kbd>S</kbd>` inside the button label (visible when `!running`).
- Stop button: `<kbd>X</kbd>` inside the Stop button (visible when `running`).
- Pause button: `<kbd>P</kbd>` inside the Pause button (visible when `running`).
- "Add to Backlog" button: `<kbd>B</kbd>` at the right of the button label (always visible).

`<kbd>` style class (add as `kbdCls` constant in file):
```
text-[10px] leading-none font-mono px-1 py-0.5 rounded border border-current opacity-50 ml-1.5
```

The badges are decorative and aria-hidden so they do not affect button accessible names.

No changes to `ControlsCardProps` are required; badges are always rendered (the shortcut hook
will simply be a no-op on pages where the hook is not mounted).

**Test strategy:** Extend `components/mission-control/controls-card.test.tsx`:
- When `running=false`, Start button contains text "S" in a `<kbd>` element.
- When `running=true`, Stop button contains text "X" in a `<kbd>` element.
- When `running=true`, Pause/Restart button contains text "P" or appropriate badge.
- Add to Backlog button always contains text "B" in a `<kbd>` element.

**Acceptance criteria:**
- [ ] `<kbd>` hint badges on Start, Stop, Pause, Add to Backlog buttons
- [ ] Badges are `aria-hidden`
- [ ] 4 new unit tests passing
- [x] No regressions in existing ControlsCard tests (13 existing tests still pass)

**Status:** done

---

### T3 — Keyboard hint badges in project layout nav

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** T1
**Description:**

In `app/project/[id]/layout.tsx`, add `<kbd>` hint badges to the navigation tab links:
- Backlog link: `<kbd>GB</kbd>`
- History link: `<kbd>GH</kbd>`
- Live link: `<kbd>GL</kbd>`

Same `kbdCls` Tailwind style as T2.

Inspect the existing nav structure in the layout file and place badges inline after the link
text, `aria-hidden`.

**Test strategy:** Snapshot or DOM query test in `app/project/[id]/layout.test.tsx` (create if
not present):
- Backlog nav item contains `<kbd>` with text "GB".
- History nav item contains `<kbd>` with text "GH".
- Live nav item contains `<kbd>` with text "GL".

**Acceptance criteria:**
- [ ] `<kbd>` hint badges on Backlog, History, Live nav items
- [ ] Badges are `aria-hidden`
- [x] 3 new unit tests passing

**Status:** done

---

### T4 — Wire `useKeyboardShortcuts` into `app/project/[id]/page.tsx`

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** T1, T2, T3
**Description:**

In `app/project/[id]/page.tsx`:

```ts
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

// Inside ProjectPage component, after existing hooks:
useKeyboardShortcuts({
  enabled: !answerOpen && !steerOpen && !backlogOpen,
  running,
  projectId,
  onStart: () => handleAction("start"),
  onStop: () => handleAction("stop"),
  onPause: () => handleAction("pause"),
  onAddBacklog: () => setBacklogOpen(true),
  navigate: (path) => { window.location.href = path; },
});
```

The `enabled` flag is derived from the existing dialog-open state booleans (`answerOpen`,
`steerOpen`, `backlogOpen`). When any dialog is open, all shortcuts are disabled — this
supplements the AD-2 element-level suppression with a React-state level guard.

**Test strategy:** Integration test in `app/project/[id]/page.test.tsx` (file already exists
from BL-050):
- Mock `GET /api/projects/${id}` to return a running project.
- `fireEvent.keyDown(document, { key: "x" })` → assert the Stop API endpoint was called.
- Mock to return an idle project.
- `fireEvent.keyDown(document, { key: "s" })` → assert the Start API endpoint was called.
- Open a dialog (e.g. set `backlogOpen` via a button click) → assert `x` keydown does NOT
  trigger stop.

**Acceptance criteria:**
- [ ] `useKeyboardShortcuts` wired in `page.tsx` with correct args
- [ ] `enabled` derived from dialog-open state
- [ ] 3 new integration tests passing
- [ ] No regressions in existing page tests
- [x] `npm run build` passes

**Status:** done

---

### T5 — Final test sweep and build verification

**Size:** S
**Agent type:** QA Lead
**Dependencies:** T1 through T4
**Description:**

1. Run `npx vitest run` — all tests must pass (expect ~15+ new tests on top of existing 519).
2. Run `NODE_ENV=production npm run build` — must complete without error.
3. Verify TypeScript: no new errors in BL-052 source files.
4. Spot-check key badge rendering does not break button accessible names (aria-hidden confirmed).
5. Verify chord timeout clears on navigation (no dangling timers after route change).

**Acceptance criteria:**
- [ ] All existing tests pass (no regressions)
- [ ] 15+ new tests added across T1–T4
- [ ] Build passes
- [ ] No TypeScript errors in new files

**Status:** pending

---

## File Manifest

| File | Action | Owner |
|------|--------|-------|
| `lib/use-keyboard-shortcuts.ts` | Create | T1 |
| `lib/use-keyboard-shortcuts.test.ts` | Create | T1 |
| `components/mission-control/controls-card.tsx` | Modify | T2 |
| `components/mission-control/controls-card.test.tsx` | Modify | T2 |
| `app/project/[id]/layout.tsx` | Modify | T3 |
| `app/project/[id]/layout.test.tsx` | Create | T3 |
| `app/project/[id]/page.tsx` | Modify | T4 |
| `app/project/[id]/page.test.tsx` | Modify | T4 |

---

## Open Questions

None. All design choices above use safe defaults. No CEO questions needed.

---

## Feature-level Acceptance Criteria

- [ ] `S` key starts the session when idle; does nothing when running
- [ ] `X` key triggers graceful stop when running; does nothing when idle
- [ ] `P` key triggers pause when running; does nothing when idle
- [ ] `B` key opens the Add to Backlog dialog regardless of state
- [ ] `G` then `B` (within 500 ms) navigates to the project backlog page
- [ ] `G` then `H` (within 500 ms) navigates to the project history page
- [ ] `G` then `L` (within 500 ms) navigates to the project live tab
- [ ] `G` alone (no follow-up in 500 ms) does nothing
- [ ] Shortcuts are suppressed when a text input is focused
- [ ] Shortcuts are suppressed when a modal/dialog is open (both element-level and state-level guard)
- [ ] Shortcuts are suppressed when meta/ctrl/alt modifier is held
- [ ] `<kbd>` hint badges visible on Start, Stop, Pause, Add to Backlog buttons in ControlsCard
- [ ] `<kbd>` hint badges visible on Backlog, History, Live nav items in project layout
- [ ] Badges are `aria-hidden` and do not affect button accessible names
- [ ] All unit tests pass
- [ ] `npm run build` passes
