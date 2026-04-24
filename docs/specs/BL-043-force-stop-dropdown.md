# BL-043: Force Stop as Dropdown on the Stop Button

## Overview

BL-037 shipped Force Stop as a standalone button below the Stop/Pause row in the Controls card. The CEO flagged this as bad UX — Force Stop should be a dropdown option nested under the existing Stop button, not a separate button. This spec replaces the standalone Force Stop button with a split-button pattern: the main Stop button retains its existing graceful-stop behavior, and a chevron caret on the right opens a dropdown containing the "Force Stop" option.

## Background

### What BL-037 shipped

- A standalone "Force Stop" button rendered in its own row below the Stop/Pause row, visible whenever `running === true`.
- Shift+click confirmation: first click shows an inline warning; Shift+click (or second click after warning) executes the hard kill.
- Styling: outline red (`border border-red-700 text-red-600`) to visually distinguish from the filled-red graceful Stop button.
- API: `POST /api/projects/[id]/force-stop` — calls `stopSession()` (SIGTERM → SIGKILL). No changes to this route are needed.

### Why the standalone button is bad UX

The standalone button adds visual weight and occupies a dedicated row for a rarely-needed power action. A split-button pattern keeps the Controls card compact while making Force Stop discoverable without cluttering the primary action hierarchy.

### No new Radix primitives available

The project has `@radix-ui/react-dialog`, `@radix-ui/react-label`, and `@radix-ui/react-switch` but no dropdown-menu or popover primitive. A lightweight custom dropdown implemented with React state and a click-outside handler is the correct approach — no new package installs needed.

### Shift+click in a dropdown menu item

Shift+click does not work ergonomically inside a dropdown — the user clicks the chevron, the menu opens, then they must hold Shift and click the item. This is unintuitive. The replacement confirmation UX is an inline confirmation row that appears in the dropdown after the first click: clicking "Force Stop" once shows "Confirm? Click again to hard-kill." with a 4-second auto-dismiss. A second click within that window executes the hard kill. This preserves the intent of BL-037's confirmation requirement while being appropriate for a menu context.

## Architecture Decisions

### AD-1: Split-button implemented as two adjacent elements sharing one visual group

The Stop button and the chevron caret are siblings inside a `flex` container styled to look like a single grouped button. The Stop button takes `flex-1` and has `rounded-l-md` (no right radius); the chevron button is a fixed-width square with `rounded-r-md` and a left border divider. This is a standard HTML/CSS split-button pattern with no library dependency.

### AD-2: Dropdown rendered as a positioned `div` — no Radix popover

A `position: absolute` dropdown div anchored below the chevron button. Visibility controlled by a `dropdownOpen` boolean in component state. A `useEffect` with a `mousedown` event listener on `document` handles click-outside dismissal. This is the minimal correct approach given no Radix popover is available.

### AD-3: Confirmation via two-click inline row in the dropdown (replaces Shift+click)

In the dropdown, "Force Stop" appears as a menu item. First click transitions the dropdown content to a confirmation state: the item label changes to "Confirm hard kill — click again" in red, with a 4-second auto-dismiss timer that resets to the default state if not confirmed. Second click within the 4-second window executes `onForceStop?.()` and closes the dropdown. This UX is clear, does not require a modal, and does not require the unintuitive Shift+click-inside-menu gesture.

### AD-4: Remove the standalone Force Stop button row entirely

The `forceStopPrompt` state, its associated timer ref, and the standalone `<button>` block (lines 149–163 of the current `controls-card.tsx`) are deleted. The `handleForceStopClick` function is replaced by `handleForceStopMenuClick` which implements the two-click confirmation. The `PendingAction` type retains `"force-stop"` for the pending label on the main Stop button area.

### AD-5: "Force Stopping…" pending state displayed on the chevron button

When `pending === "force-stop"`, the chevron button label area shows a brief "..." indicator and all buttons are disabled — same behavior as BL-037. The 3-second pending timer is unchanged.

### AD-6: Dropdown only visible when running; chevron is hidden when not running

When `running === false`, the Stop button is not rendered at all (Start button takes its place). No change to that logic. When `running === true`, the split-button group replaces the standalone Stop button.

### AD-7: No changes to the force-stop API route or mission control page wiring

`app/api/projects/[id]/force-stop/route.ts` is unchanged. `app/project/[id]/page.tsx` already passes `onForceStop={handleForceStop}` to `<ControlsCard />` — no changes needed there either.

### AD-8: Close dropdown on Stop main-button click and on Escape key

When the user clicks the main Stop action, if the dropdown is open, close it before firing the stop handler. Also close on `Escape` keydown for keyboard accessibility.

## Sub-tasks

### T1: Refactor ControlsCard — split-button with dropdown

- **Size:** M
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/mission-control/controls-card.tsx`
- **Logic:**
  1. Remove the standalone Force Stop button block (lines 148–163 in current file), the `forceStopPrompt` state, `forceStopPromptTimer` ref, and `handleForceStopClick` function.
  2. Add state: `dropdownOpen: boolean`, `forceConfirmPending: boolean`.
  3. Add ref: `forceConfirmTimer: ReturnType<typeof setTimeout> | null`, `dropdownRef: RefObject<HTMLDivElement>`.
  4. Add `useEffect` to attach `mousedown` listener on `document` for click-outside dismissal; close dropdown when click is outside `dropdownRef`.
  5. Add `useEffect` to attach `keydown` listener for `Escape` → close dropdown.
  6. Replace the solo `<button onClick={handleStop}>` with a split-button group:
     ```tsx
     <div className="flex-1 flex rounded-md overflow-hidden">
       {/* Main Stop button */}
       <button
         onClick={() => { setDropdownOpen(false); handleStop(); }}
         disabled={pending === "stop" || forceStopping}
         className="flex-1 px-3 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:opacity-70 disabled:cursor-not-allowed text-white transition"
       >
         {stopLabel}
       </button>
       {/* Chevron caret — opens Force Stop dropdown */}
       <button
         onClick={() => { setDropdownOpen(o => !o); setForceConfirmPending(false); }}
         disabled={forceStopping}
         aria-label="More stop options"
         className="px-2 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:opacity-70 disabled:cursor-not-allowed text-white border-l border-red-600 transition"
       >
         <ChevronDown size={14} />
       </button>
     </div>
     ```
  7. Render dropdown `div` (absolute, below the chevron, `z-10`, min-width matches button group) when `dropdownOpen && !forceStopping`:
     - If `!forceConfirmPending`: show button "Force Stop" — on click: set `forceConfirmPending = true`, start 4s auto-dismiss timer.
     - If `forceConfirmPending`: show button "Confirm hard kill — click again" (red text) — on click: execute force stop (`setPending("force-stop")`, call `onForceStop?.()`, close dropdown, clear timer).
  8. Import `ChevronDown` from `lucide-react` (already a project dependency).
  9. Cleanup: clear `forceConfirmTimer` in the `useEffect` cleanup alongside existing timers.
- **Acceptance criteria:**
  - Stop button left segment fires graceful stop (existing behavior unchanged)
  - Chevron opens a dropdown with "Force Stop" item
  - First click on "Force Stop" item shows confirmation text; does NOT call `onForceStop`
  - Second click (within 4s) calls `onForceStop` and closes dropdown
  - After 4s of inaction, confirmation resets to "Force Stop" label
  - Clicking outside the dropdown closes it
  - Pressing Escape closes the dropdown
  - `forceStopping` state disables both the main Stop button and the chevron
  - "Force Stopping…" label appears in the chevron area during pending (or main label — either acceptable)
  - Standalone Force Stop button row is gone
- **Status:** done

### T2: Update ControlsCard unit tests

- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `components/mission-control/controls-card.test.tsx`
- **Logic:**
  - Remove tests that reference the standalone Force Stop button by role name `"Force Stop"` as a standalone row button (tests on lines 50–122 of current test file).
  - Add replacement tests:
    1. `"renders chevron dropdown button when running"` — `getByRole("button", { name: /more stop options/i })` is present; standalone Force Stop button row absent.
    2. `"opens dropdown on chevron click and shows Force Stop option"` — click chevron; assert `getByText(/Force Stop/)` visible.
    3. `"first click on Force Stop shows confirmation, does not call onForceStop"` — click chevron, click "Force Stop", assert `onForceStop` not called, assert confirmation text visible.
    4. `"second click executes force stop"` — click chevron, click "Force Stop", click confirmation button; assert `onForceStop` called once.
    5. `"confirmation auto-dismisses after 4s"` — click chevron, click "Force Stop", advance timers 4100ms; assert "Force Stop" label (not confirmation) is shown.
    6. `"Escape closes dropdown"` — open dropdown, fire keydown Escape, assert dropdown closed.
    7. `"Stop main-button click still fires onStop"` — ensure split-button left segment fires `onStop` (existing behavior). The existing test that checks `Stopping…` label may need minor selector update if button is now inside a flex wrapper — verify and adjust.
  - Existing Stop/Pause label-swap tests and caption auto-hide test should pass unchanged or with minimal selector adjustments.
- **Acceptance criteria:**
  - All new tests pass
  - No tests reference the removed standalone Force Stop row button
  - `npx vitest run` green (full suite)
- **Status:** done

### T3: E2E smoke verification with Playwright

- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (generic)
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Navigate to mission control for haze project.
  2. Confirm standalone "Force Stop" button row is absent.
  3. Confirm Stop button renders as a split-button group with a chevron caret.
  4. Click chevron — verify dropdown opens with "Force Stop" item.
  5. Click "Force Stop" — verify confirmation text appears ("Confirm hard kill" or similar); verify `onForceStop` NOT called yet.
  6. Click confirmation — verify "Force Stopping…" state (or verify via network interceptor that `/force-stop` POST fires).
  7. Click elsewhere — verify dropdown closes.
  8. Screenshot for record.
- **Note:** Not an automated test file — Playwright MCP used interactively at VERIFY time.
- **Acceptance criteria:** All 8 steps pass visually.
- **Status:** pending

## Files Touched

| File | Change |
|------|--------|
| `components/mission-control/controls-card.tsx` | Replace standalone Force Stop button with split-button + dropdown pattern |
| `components/mission-control/controls-card.test.tsx` | Replace Shift+click tests with dropdown interaction tests |

## No Changes Required

- `app/api/projects/[id]/force-stop/route.ts` — API is unchanged; still called via `onForceStop` prop
- `app/project/[id]/page.tsx` — `onForceStop={handleForceStop}` wiring already exists; no changes
- `lib/session-manager.ts` — `stopSession()` unchanged
- `components/project-card.tsx` — Force Stop scoped to mission control only (per BL-037 AD-6)

## Test Strategy Summary

- Unit tests (vitest): T2 replaces ~6 existing tests and adds ~7 new interaction tests in `controls-card.test.tsx`. Full suite must remain green.
- E2E: Playwright MCP at VERIFY time (T3).
- No new test files needed — only `controls-card.test.tsx` is modified.

## Questions Posted

None. The dropdown-over-split-button pattern is unambiguous given available primitives; confirmation UX (two-click) is a direct substitute for Shift+click that works correctly in a menu context.
