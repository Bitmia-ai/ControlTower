# T048 — Live Tab: User Boxes Collapsible and Collapsed by Default

**Type:** bug / UX
**Priority:** P1
**Source:** CEO
**Iteration planned:** 57

## Overview

The CEO reports that "User boxes" in the Live tab need to be collapsible and collapsed by default. This spec diagnoses what "User boxes" are, whether they are currently collapsed, and what change (if any) is required.

## Diagnosis

### What are "User boxes"?

In the Live tab (`/project/[id]/live`), `TranscriptViewer` renders four event types:

| Event type | Component | Visual |
|---|---|---|
| `assistant/tool_use` | `ToolUseCard` | Grey box, yellow tool name, collapsible |
| `assistant/thinking` | `ThinkingCard` | Violet box, collapsible |
| `assistant/text` | `AssistantTextCard` | White/zinc card, red left border, always open |
| `user/tool_result` | `ToolResultCard` | Grey box, cyan label, collapsible |
| `user` (no subtype) | suppressed | Not rendered (T040) |

The CEO's "User boxes" refers to `ToolResultCard` — the grey cards rendered for `user/tool_result` events. These show the output of tool calls (stdout/stderr from Bash, file content from Read, grep output, etc.) and can contain hundreds of lines.

### Are they currently collapsed by default?

**Yes — but with a significant UX flaw.**

`ToolResultCard` uses `useOpenState(forceOpen)`:

```typescript
function useOpenState(forceOpen: boolean | null) {
  const [open, setOpen] = useState(false);   // ← default: false = collapsed
  const effectiveOpen = forceOpen === null ? open : forceOpen;
  return { open: effectiveOpen, toggle: () => setOpen((v) => !v) };
}
```

When `forceOpen` is `null` (the live page's default), `open = false`, so the card is collapsed. The header row (toggle button) is always visible, but the body `<pre>` is not rendered.

### Root cause: the Expand All / Collapse All button does not reset local state

The `forceExpanded` prop in `live/page.tsx` starts as `null`. When the user clicks "Expand All", it sets `forceExpanded = true`. Every `ToolResultCard` (and `ToolUseCard`, `ThinkingCard`) becomes open.

When the user then clicks "Expand All" again (toggling it back to `null`), the `forceOpen` prop becomes `null`. Each card's `effectiveOpen` reverts to the card's own `open` local state. **But the local `open` state was never updated during the force-expand phase** — `toggle()` was never called while `forceOpen` was `true`. So when `forceOpen` returns to `null`, each card's local `open` is still `false`, and they correctly return to collapsed.

This means the toggle lifecycle is technically correct. There is no code bug causing open-by-default.

### Why the CEO sees "open" boxes

The likely cause is one of:

1. **The Expand All button was active.** When `forceExpanded = true`, all cards are open. The CEO may have observed this state and expected a "reset to default" to collapse them without needing to click "Collapse All".
2. **Visual ambiguity.** The `ToolResultCard` header row (always visible, with a chevron, tool name, "result" label, and a preview snippet) may read as an "open" or "visible" box to a user who expects tool output to be completely invisible until requested. The preview text (first non-empty line, up to 80 chars) appearing in the header may give the impression the card is already showing content.
3. **ThinkingCard, ToolUseCard, and ToolResultCard all have the same header-always-visible pattern.** But the CEO specifically says "User boxes" — which maps to `ToolResultCard` (the only boxes arising from `user`-type events).

### Conclusion

The behavior change needed is not a default-state fix (it's already `false`). The fix is:

1. **Confirm and harden the collapsed-by-default guarantee** with explicit tests that cover the `forceExpanded null → true → null` cycle and ensure cards return to collapsed.
2. **Reduce the visual footprint** of collapsed `ToolResultCard` headers when the body is a large tool output: the preview snippet in the collapsed header is useful but can be made more compact to clarify the collapsed nature.
3. **Ensure the "Collapse All" button reliably resets cards to a visually collapsed state** — including local state — so the CEO has a one-click way to collapse all boxes regardless of any prior toggles.

## Architecture Decisions

### AD-1: No change to default state — `useState(false)` is correct

`ToolResultCard` already starts collapsed. No change to `useOpenState` or its initial value.

### AD-2: Fix Collapse All to reset local state (not just override via forceOpen)

The current `useOpenState` pattern: when `forceOpen = false`, cards appear collapsed (correct). When `forceOpen` returns to `null`, each card reverts to its own `open` local state. If the user manually expanded a card before pressing "Collapse All", that card's local state is `true`, so when `forceOpen` returns to `null` again, the card re-opens. This is a real UX issue.

Fix: when `forceOpen` transitions from `false` to `null`, local `open` should be reset to `false`. Implement by adding a `useEffect` inside `useOpenState` that resets `open` to `false` whenever `forceOpen` transitions from `false` (or `true`) to `null`.

Alternatively — simpler and more predictable: when `forceOpen` changes to `false`, also update the local `open` state to `false`. This means "Collapse All" permanently collapses each card until the user manually re-opens them.

Decision: **sync local state with forceOpen when forceOpen is non-null**. Add a `useEffect` in `useOpenState`:

```typescript
useEffect(() => {
  if (forceOpen !== null) {
    setOpen(forceOpen);
  }
}, [forceOpen]);
```

This ensures:
- When `forceOpen = true`: local state becomes `true`.
- When `forceOpen = false`: local state becomes `false`.
- When `forceOpen = null`: no effect on local state. Since local state was last set to whatever `forceOpen` was before returning to `null`, the card retains that value.
- Net result: "Collapse All" (sets `forceOpen = false`) permanently closes each card, even ones the user had manually opened.

### AD-3: No visual redesign — the preview snippet stays

The preview snippet in the `ToolResultCard` header (first non-empty line, up to 80 chars) is a useful affordance for the user to quickly identify what the tool returned without expanding. It stays as-is.

### AD-4: No changes to the SSE stream, normalizer, or live page props

The `forceExpanded` prop mechanism and the event rendering pipeline are correct. The fix is isolated to `useOpenState` inside `transcript-viewer.tsx`.

### AD-5: Both test files are in scope

Two test files cover `TranscriptViewer`:
- `components/transcript-viewer.test.tsx` — T040 tests (ThinkingCard, AssistantTextCard, etc.)
- `components/__tests__/transcript-viewer.test.tsx` — additional ToolResultCard and findPrecedingToolName tests

New tests should be added to `components/__tests__/transcript-viewer.test.tsx` to match the existing pattern for ToolResultCard tests.

## Sub-tasks

### T1: Fix `useOpenState` — sync local state with forceOpen transitions
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/transcript-viewer.tsx`
- **Change:**
  - Add `import { useState, useEffect } from "react"` (add `useEffect` to existing import)
  - Inside `useOpenState(forceOpen: boolean | null)`, add:
    ```typescript
    useEffect(() => {
      if (forceOpen !== null) {
        setOpen(forceOpen);
      }
    }, [forceOpen]);
    ```
  - This syncs local `open` state whenever `forceOpen` is explicitly set (true or false), ensuring "Collapse All" is sticky and "Expand All" is sticky even after returning to per-card mode.
- **Test strategy:** Unit test — render a card, manually click to open it, then simulate `forceExpanded=false` (via re-render), then simulate `forceExpanded=null` (via re-render). Assert card remains closed.
- **Acceptance criteria:**
  - After "Collapse All" (`forceExpanded=false`) followed by returning to `null`, previously-opened cards stay collapsed.
  - After "Expand All" (`forceExpanded=true`) followed by returning to `null`, all cards remain open (the user opened them intentionally via Expand All).
  - On fresh page load, all `ToolResultCard` instances are collapsed (unchanged behavior).
- **Status:** done

### T2: Unit tests for collapse/expand lifecycle
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `components/__tests__/transcript-viewer.test.tsx`
- **Test cases to add:**
  1. `ToolResultCard` starts collapsed on fresh render (no `forceExpanded` prop) — body `<pre>` absent.
  2. `ToolResultCard` with `forceExpanded=true` shows body content.
  3. `ToolResultCard` with `forceExpanded=false` hides body content (even after manual click-to-open followed by re-render with `forceExpanded=false`).
  4. After `forceExpanded` transitions `null → false → null`, card remains collapsed (T1 fix verification).
  5. After `forceExpanded` transitions `null → true → null`, card remains open (T1 fix verification).
  6. `ToolUseCard` same lifecycle: `forceExpanded null → false → null` leaves it collapsed.
  7. `ThinkingCard` same lifecycle: `forceExpanded null → false → null` leaves it collapsed.
- **Test strategy:** vitest + React Testing Library. Use `rerender` from `@testing-library/react` to simulate `forceExpanded` prop changes.
- **Acceptance criteria:**
  - All 7 new test cases pass.
  - Full suite (`npx vitest run`) remains green.
- **Status:** done

## Files Touched

| File | Change |
|---|---|
| `components/transcript-viewer.tsx` | Add `useEffect` to `useOpenState` to sync local state with forceOpen transitions |
| `components/__tests__/transcript-viewer.test.tsx` | Add 7 new lifecycle test cases for `ToolResultCard`, `ToolUseCard`, `ThinkingCard` |

## No Changes Required

| File | Reason |
|---|---|
| `components/transcript-viewer.test.tsx` | T040 tests are unaffected; no changes needed |
| `app/project/[id]/live/page.tsx` | `forceExpanded` state management is correct; no changes needed |
| `lib/redeye-types.ts` | No type changes needed |
| `lib/transcript-normalizer.ts` | Not involved |
| `app/api/projects/[id]/stream/route.ts` | Not involved |

## Test Strategy Summary

- **Unit tests (vitest):** T2 adds 7 lifecycle test cases covering the `forceExpanded` state transition cycle for all three collapsible card types. The key scenario is `null → false → null` (Collapse All then return to per-card) and `null → true → null` (Expand All then return to per-card). Uses `rerender` from React Testing Library.
- **Regression:** Full `npx vitest run` must remain green (currently 409 tests).
- **E2E:** Visual verification with Playwright at VERIFY time — navigate to Live tab, confirm all tool-result cards render collapsed on load, use Expand All / Collapse All buttons, verify sticky behavior.

## Acceptance Criteria

1. On page load, all `ToolResultCard` boxes are collapsed (header visible, body `<pre>` not in DOM).
2. "Collapse All" closes all open cards and keeps them closed when returning to per-card mode.
3. "Expand All" opens all cards and keeps them open when returning to per-card mode.
4. Individual card click-to-toggle works correctly in per-card mode.
5. All 7 new unit tests pass; full suite green.
6. Build clean (`NODE_ENV=production npm run build`).

## Questions Posted

None. The diagnosis is clear from code inspection. No ambiguity in the CEO request — `ToolResultCard` (user/tool_result) boxes are the target, and the fix is a `useEffect` sync in `useOpenState` plus test coverage.
