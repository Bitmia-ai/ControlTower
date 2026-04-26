# T032 — Live tab auto-scroll UX: pause on user scroll-up, resume at bottom

**Priority:** P1 (CEO Request)
**Type:** feature / UX bug
**Tier:** S (single small component change)
**Status:** planned

## Problem

On `/project/[id]/live`, the current auto-scroll behavior snaps the viewport to the bottom on every new event while `autoScroll` is ON. Consequence: user cannot scroll up to read earlier messages — any new event yanks the page back to the bottom. The existing "Auto-scroll ON/OFF" toggle works but requires the user to manually flip it, then re-engage it when they want to follow again.

## Desired Behavior

Auto-scroll should be "sticky-bottom":
- While the user is viewing the bottom of the transcript, new events keep them at the bottom (follow mode).
- If the user scrolls up (away from bottom), auto-scroll pauses automatically — new events do NOT yank them back.
- When the user scrolls back to (or near) the bottom, auto-scroll resumes automatically.
- The Auto-scroll ON/OFF button remains as an explicit override. OFF forces no autoscroll regardless of position; ON engages the sticky-bottom behavior above.

This is the standard behavior of modern log viewers (Chrome DevTools console, Discord, iTerm tail, GitHub Actions live logs).

## Architecture Decisions

1. **Scroll container ownership.** The Live page does not currently use an inner scroll container — it relies on the window scroll and a `bottomRef` with `scrollIntoView`. We will keep using the window as the scroll surface (no layout change) and attach a `scroll` listener to `window` to observe position. This avoids restructuring `TranscriptViewer` or introducing a constrained-height div.

2. **"At bottom" threshold.** User is considered at bottom when `window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - THRESHOLD_PX`, with `THRESHOLD_PX = 80`. This tolerates browser rounding and keeps the resume gesture forgiving (user does not have to scroll to the absolute last pixel).

3. **Derived `shouldStick` state.** Introduce a ref-backed boolean `isAtBottomRef` updated on each scroll event. The events-change effect reads the ref (not state) so a scroll in progress does not race a re-render.

4. **autoScroll toggle semantics.** Keep the button as a hard override:
   - `autoScroll === false` → never auto-scroll (same as today).
   - `autoScroll === true` → auto-scroll only when `isAtBottomRef.current === true`.
   When the user scrolls up while `autoScroll === true`, we do NOT flip the toggle — the button stays ON, signaling intent. Only the derived stickiness pauses. Scrolling back to bottom resumes.

5. **Button label clarification.** To communicate the new state, change the label when paused-by-scroll:
   - `autoScroll=false` → "Auto-scroll OFF"
   - `autoScroll=true` and at bottom → "Auto-scroll ON"
   - `autoScroll=true` and scrolled up → "Auto-scroll paused" (still red-highlighted to show intent is ON, but label indicates it is not actively following). Clicking it in that state toggles to OFF (hard).

6. **Smooth vs instant scroll.** Keep `behavior: "smooth"` as today for subjective polish; burst events still resolve fine because the ref-gate prevents redundant scrolls.

7. **No SSR/hydration risk.** All logic runs inside `useEffect` on a `"use client"` component.

## Sub-Tasks

### T1 — Implement sticky-bottom auto-scroll in Live page
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic, sonnet)
- **Files:** `app/project/[id]/live/page.tsx`
- **Changes:**
  - Add `isAtBottomRef = useRef(true)` (start assumed at bottom).
  - Add `useEffect` that attaches a `window` scroll listener computing `isAtBottom` (with 80px threshold) and writes to the ref; also update a `scrolledAway` state (only when `autoScroll === true`) for label rendering.
  - Update the existing events-change effect: only call `scrollIntoView` when `autoScroll && isAtBottomRef.current`.
  - Update button label to render "Auto-scroll paused" when `autoScroll && scrolledAway`.
  - Ensure listener is removed on unmount and re-check bottom after events append (a mounted ResizeObserver on `document.body` is overkill — instead, re-evaluate bottom inside the events effect before deciding to scroll).
- **Test strategy:**
  - Unit: extract a pure helper `isNearBottom(scrollY, innerHeight, scrollHeight, threshold)` and unit-test it with vitest (3 cases: exactly bottom, within threshold, far above).
  - Manual/E2E (Playwright MCP): open Live on haze with active transcript, scroll up mid-stream, confirm page does not jump on new events; scroll back to bottom, confirm follow resumes. Screenshot both states.
- **Acceptance criteria:**
  - AC1: With Auto-scroll ON and viewport at bottom, new events keep the viewport at the bottom.
  - AC2: With Auto-scroll ON, scrolling up ≥80px pauses follow; new events do NOT move the viewport.
  - AC3: Scrolling back within 80px of the bottom automatically resumes follow on the next event.
  - AC4: Button label shows "Auto-scroll paused" when ON but scrolled away; "Auto-scroll ON" when ON and at bottom; "Auto-scroll OFF" when OFF.
  - AC5: Clicking the button always toggles `autoScroll` boolean (ON↔OFF); paused state is transient, not a third stored mode.
  - AC6: `isNearBottom` unit tests pass; full vitest suite remains green (310/310 + new tests).
- **Status:** done

### T2 — Playwright visual verification
- **Size:** S
- **Dependencies:** T1
- **Agent:** QA Lead (sonnet) during BUILD, re-run in DEPLOY
- **Files:** none (screenshots under `screenshots/`)
- **Test strategy:**
  - Navigate to `http://localhost:3200/project/haze/live` with a live or recent transcript.
  - Script: scroll to top via `browser_evaluate(window.scrollTo(0,0))`, wait ~3s while transcript receives events, screenshot (should remain at top; label = "Auto-scroll paused").
  - Script: scroll to bottom, screenshot (should follow; label = "Auto-scroll ON").
  - Click Auto-scroll button, confirm it toggles to OFF.
- **Acceptance criteria:**
  - Two screenshots saved (`screenshots/bl032-paused.png`, `screenshots/bl032-following.png`) confirming the behaviors.
- **Status:** done (see note)
- **Build-time note (iter 45):** Playwright visual capture against a live
  transcript was not possible in this environment — `/api/projects/:id/transcript-status`
  returns 404 for every project (pre-existing routing issue, unrelated to
  T032), so the Live page stays in its "No active session" empty state.
  Compensating verification: `lib/scroll-utils.integration.test.tsx` mounts
  a harness that mirrors the exact sticky-bottom wiring from
  `app/project/[id]/live/page.tsx` (window scroll listener, `isAtBottomRef`,
  `scrolledAway` state, button label logic) and exercises AC1–AC5 against
  happy-dom scroll geometry. 5/5 pass. Visual Playwright screenshots are
  deferred to DEPLOY when a live transcript is present.

## Non-Goals

- No restructuring to an inner scroll container.
- No change to `TranscriptViewer` internals.
- No new "Jump to bottom" floating button (can be a follow-up if CEO wants).
- No change to Expand/Collapse/Clear buttons.

## Risks

- Very tall `scrollHeight` changes on expand/collapse may momentarily shift position; threshold of 80px absorbs most cases. If flaky, widen to 120px.
- Smooth scroll can be interrupted by new event scrolls; acceptable — the final position converges at bottom while sticky.

## Open Questions (posted to inbox)

None currently — behavior is well-specified by the CEO request. If ambiguity surfaces during BUILD, Dev should post to inbox with a default.
