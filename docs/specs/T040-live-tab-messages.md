# T040 — Live Tab: Inter-Round Messages and Thought Blocks Not Showing

**Type:** bug / feature  
**Priority:** P1  
**Source:** CEO  
**Iteration planned:** 56

## Overview

The Live tab (`/project/[id]/live`) shows the SSE transcript stream but the CEO reports that only tool-use entries are visible. Claude's inter-round assistant text messages (`subtype: "text"`) and extended-thinking blocks (`subtype: "thinking"`) are either not rendered or not rendered with enough visual weight to be noticed.

This spec diagnoses the root cause and prescribes rendering fixes so all three content types — tool calls, text messages, and thoughts — are clearly and distinctly visible in the Live tab.

## Background

### Data flow: JSONL to UI

```
~/.claude/projects/{enc}/*.jsonl
       │
       │  tailJsonl (lib/stream-utils.ts)
       ▼
normalizeTranscriptLine (lib/transcript-normalizer.ts)
       │  converts raw envelope → ClaudeStreamEvent[]
       ▼
SSE stream (app/api/projects/[id]/stream/route.ts)
       │  data: {type, subtype, content, ...}
       ▼
EventSource in live/page.tsx
       │  setEvents(prev => [...prev, event])
       ▼
TranscriptViewer (components/transcript-viewer.tsx)
       │  renders each ClaudeStreamEvent
       ▼
Browser DOM
```

### What the normalizer produces

`normalizeTranscriptLine` already handles all three subtypes correctly:

| Raw JSONL content block | `ClaudeStreamEvent` produced |
|---|---|
| `{type:"thinking", thinking:"..."}` | `{type:"assistant", subtype:"thinking", content:"..."}` |
| `{type:"text", text:"..."}` | `{type:"assistant", subtype:"text", content:"..."}` |
| `{type:"tool_use", name:"Bash", input:{...}}` | `{type:"assistant", subtype:"tool_use", tool_name:"Bash", tool_input:{...}}` |
| `{type:"tool_result", content:"..."}` (in user envelope) | `{type:"user", subtype:"tool_result", content:"..."}` |

The normalizer is **not the problem**. All three subtypes are emitted by the SSE stream.

### What the real JSONL looks like

A real assistant envelope (from the Claude CLI transcript directory):

```json
{
  "parentUuid": "...",
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6",
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "The user wants to start the autonomous development loop..."
      }
    ],
    "usage": { "input_tokens": 3, "cache_creation_input_tokens": 20530, ... }
  },
  ...
}
```

In practice, most turns produce an assistant envelope that contains **only a thinking block** (when Claude is reasoning) or **only a text block** (inter-round narration like "Loop infrastructure is in place. Now invoking the skill."). The normalizer correctly maps these.

### Root cause: rendering gaps in TranscriptViewer

`TranscriptViewer` currently renders:

1. **`assistant/tool_use`** — `ToolUseCard` component: grey box, collapsible, yellow tool name label. Visually prominent.
2. **`user/tool_result`** — `ToolResultCard` component: grey box, collapsible, cyan label. Visually prominent.
3. **`assistant/thinking`** — bare `<p className="text-sm italic text-gray-400 dark:text-zinc-500">`. No container box. The light grey italic text on a grey background reads as a watermark rather than a content block. **Effectively invisible to a casual viewer.**
4. **`assistant/text`** — a white/zinc-900 card with `text-gray-900 dark:text-white` text and `whitespace-pre-wrap`. This renders correctly in theory, but in practice the CEO still does not see it. Likely cause: inter-round text messages in real sessions are often very short (one line like "Calling tool…") and may be scrolled past when surrounded by many tool cards.
5. **`user` (non-tool-result)** — fallback case: small uppercase `event.type` label + grey body text. Used for the initial user prompt message. Rendered very subtly and inconsistently labeled.

The T031 goal was "Claude's text and thoughts unfolded and prominent." The text card is technically unfolded but the thinking card is styled too subtly. The CEO's report confirms that thoughts are invisible in practice.

## Architecture Decisions

### AD-1: Fix is entirely in TranscriptViewer — no changes to normalizer, stream, or API

The data flows correctly from JSONL through SSE to the event array. The fix is purely presentational, confined to `components/transcript-viewer.tsx`.

### AD-2: Thinking blocks need a container card

Replace the bare italic paragraph for `assistant/thinking` with a collapsible `ThinkingCard` component. Reasoning:
- Thinking blocks can be very long (hundreds of words). A collapsed-by-default card with a first-line preview matches the pattern used for tool calls.
- The card is styled distinctly from tool cards: purple/violet accent to match the "internal reasoning" concept. Collapsed by default, but the "Expand all" global toggle works on it.
- This makes the thinking block discoverable (header always visible) without dumping raw thought text inline.

### AD-3: Text messages need a stronger visual anchor and a role label

The current `assistant/text` card has no label indicating it is Claude speaking. Add a small "Claude" label (or a left-border accent) so the CEO can immediately identify inter-round messages from Claude vs. other card types.

Design: add a subtle red left border (matching the brand accent `border-l-2 border-red-500`) and a small `"Claude"` label in the card header. Content renders with `whitespace-pre-wrap` as today.

### AD-4: User prompt messages should be hidden by default

The initial user message (the CTO prompt sent to Claude each iteration, `type:"user"` with string content) is very long and not useful to display in the Live tab — it's the system prompt that kicks off each iteration. Render it collapsed with a "User message" label (or suppress it entirely). The `user/tool_result` cards are already handled by `ToolResultCard`.

Decision: **suppress plain `user` messages** (non-tool-result). These are the initial prompt injected by the harness and contain no information the CEO needs to see. They would bury the Claude messages if rendered.

### AD-5: "Expand all" / "Collapse all" must work on ThinkingCard

`ThinkingCard` receives `forceOpen: boolean | null` just like `ToolUseCard` and `ToolResultCard`. The existing `forceExpanded` prop on `TranscriptViewer` is passed through.

### AD-6: No new types or SSE protocol changes

`ClaudeStreamEvent` already has `subtype: "thinking"`. No changes to `redeye-types.ts`, `transcript-normalizer.ts`, or the stream route.

## Sub-tasks

### T1: ThinkingCard component
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/transcript-viewer.tsx`
- **Change:** Add `ThinkingCard` function component (inline, matching file pattern).
  - Props: `event: ClaudeStreamEvent`, `forceOpen: boolean | null`
  - Collapsed state: violet/purple header with brain icon text `"Thinking…"` + first 80-char preview of `event.content`
  - Expanded state: full `event.content` rendered as `whitespace-pre-wrap` text in a soft violet-tinted panel
  - Styling: `bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800` with `text-violet-700 dark:text-violet-300` header label
  - Respects `forceOpen` via `useOpenState` (existing helper)
  - Default state: **collapsed** (thinking blocks can be very long)
- **Test strategy:** Unit test in `components/transcript-viewer.test.tsx` — render a `thinking` event via `TranscriptViewer`, assert the collapsed header contains preview text; click to expand, assert full content visible.
- **Acceptance criteria:**
  - `assistant/thinking` events render as a collapsible violet card, not a bare italic paragraph
  - Header preview truncated to 80 chars with ellipsis
  - Expand/collapse works on click
  - "Expand all" / "Collapse all" global buttons control ThinkingCard state
  - Dark mode styling correct
- **Status:** done

### T2: AssistantTextCard — add Claude label and left-border accent
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/transcript-viewer.tsx`
- **Change:** Extract the existing inline `assistant/text` rendering into a named `AssistantTextCard` component.
  - Add `border-l-2 border-red-500` left accent
  - Add a small header label `"Claude"` in `text-xs font-medium text-red-600 dark:text-red-400 mb-1`
  - Content renders below the label with `whitespace-pre-wrap text-sm text-gray-900 dark:text-white`
  - No collapse behavior — text messages are always visible (they are the primary signal)
- **Test strategy:** Unit test — render `{type:"assistant", subtype:"text", content:"Hello world"}` via `TranscriptViewer`, assert the "Claude" label and text content are both present in the DOM.
- **Acceptance criteria:**
  - Red left border and "Claude" label visible on all inter-round text messages
  - Content fully visible (not truncated, not collapsible)
  - Dark mode correct
- **Status:** done

### T3: Suppress plain user messages
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `components/transcript-viewer.tsx`
- **Change:** In the `TranscriptViewer` render loop, add a guard: if `event.type === "user" && event.subtype !== "tool_result"`, return `null` (skip rendering). This suppresses the harness-injected user prompt without affecting tool results.
- **Test strategy:** Unit test — render a `{type:"user", content:"Long user prompt..."}` event alongside a tool result; assert only the tool result renders, not the raw user message.
- **Acceptance criteria:**
  - User prompt messages (no subtype) do not appear in the transcript
  - `user/tool_result` events are unaffected
- **Status:** done

### T4: Unit tests
- **Size:** S
- **Dependencies:** T1, T2, T3
- **Agent:** Dev (generic)
- **Files:**
  - `components/transcript-viewer.test.tsx` (new file — no existing test file for this component)
- **Test cases:**
  1. `thinking` event: collapsed header with preview text present; toggle opens full content
  2. `thinking` event: "Expand all" (`forceExpanded=true`) shows content without clicking
  3. `text` event: "Claude" label and content both rendered; no collapse button
  4. `tool_use` event: existing ToolUseCard behavior unchanged
  5. `tool_result` event: existing ToolResultCard behavior unchanged
  6. `user` plain event: renders nothing (null/empty)
  7. `__session_boundary__`: separator line still renders
  8. `findPrecedingToolName` pure helper: existing tests still pass (already tested via export)
- **Test strategy:** vitest + React Testing Library (same pattern as other component tests in the project).
- **Acceptance criteria:**
  - All 8 new cases pass
  - `npx vitest run` green (full suite)
- **Status:** done

### T5: E2E verification with Playwright
- **Size:** S
- **Dependencies:** T1, T2, T3, T4
- **Agent:** Dev (generic)
- **Verification approach:** Playwright MCP against `http://localhost:3200` with a live session running.
  1. Start a RedEye session on the haze project
  2. Navigate to the Live tab
  3. Wait for events to stream in
  4. Assert: at least one violet "Thinking…" card is visible in the transcript
  5. Assert: at least one "Claude" labeled red-border card is visible
  6. Assert: no raw user prompt text block visible
  7. Click "Expand all" — verify ThinkingCard content becomes visible
  8. Screenshot for record
- **Acceptance criteria:** All 8 steps pass visually
- **Status:** pending

## Files Touched

| File | Change |
|---|---|
| `components/transcript-viewer.tsx` | Add `ThinkingCard`; add `AssistantTextCard`; suppress plain `user` events |
| `components/transcript-viewer.test.tsx` | New file: 8 unit test cases for all event types |

## No Changes Required

| File | Reason |
|---|---|
| `lib/transcript-normalizer.ts` | Already produces all three subtypes correctly |
| `lib/redeye-types.ts` | `ClaudeStreamEvent` type is sufficient; `subtype:"thinking"` already defined |
| `app/api/projects/[id]/stream/route.ts` | Stream emits all events correctly |
| `app/project/[id]/live/page.tsx` | `events` state already receives all event types |
| `lib/stream-utils.ts` | No change needed |

## Test Strategy Summary

- **Unit tests (vitest):** T4 creates `components/transcript-viewer.test.tsx` with 8 cases. Full suite must remain green. The `findPrecedingToolName` exported helper already has coverage; new tests focus on rendered output.
- **E2E:** Playwright MCP at VERIFY time (T5). Requires a live session.
- No changes to existing tests.

## Questions Posted

None. Root cause is clear from code inspection. Implementation approach is straightforward given the existing component patterns (`ToolUseCard`, `ToolResultCard` as models for `ThinkingCard`). Visual treatment (violet for thinking, red-border for Claude text) is consistent with existing color system.
