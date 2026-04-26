# T031 — Live Tab Transcript Viewer: Fold Tool/Terminal Output by Default

**Type:** feature
**Priority:** P1
**Source:** CEO
**Iteration planned:** 43

## Problem

The Live tab currently renders the Claude transcript as a visually noisy mixed feed. While `tool_use` calls are already collapsed via `ToolUseCard`, **tool results** (`type: "user"`, `subtype: "tool_result"`) render as bulky untitled cards with full raw output (Bash output, Read contents, Grep dumps, etc). The viewer reads like a raw JSONL dump instead of a readable session log.

CEO wants the Live tab to look like a **conversation transcript**: Claude's messages and thoughts unfolded and prominent, with tool calls and tool results both folded behind compact one-line headers the user can click to expand.

## Goals

1. Fold tool results by default (currently they render expanded).
2. Pair each tool result visually with its preceding tool call (same compact style, same fold-by-default treatment).
3. Keep Claude's `text` (assistant messages) and `thinking` blocks unfolded and prominent — these are the signal.
4. Provide a global "Expand all" / "Collapse all" control in the Live tab header for power users.
5. Preserve session-boundary separators and ResultCard (session summary/usage) behavior.

## Non-Goals

- No changes to SSE stream protocol or transcript normalizer (data shape stays the same).
- No reordering or pairing logic that mutates transcript order — purely presentational.
- No truncation / virtualization (separate concern; defer).
- Auto-scroll UX fix is T032 — out of scope here.

## Architecture Decisions

### AD-1: Fold tool_result in a ToolResultCard component

Mirror the existing `ToolUseCard` pattern. Introduce a new `ToolResultCard` that:
- Renders a one-line header with a disclosure triangle, a monospaced label (`tool result` or, when available, the matching tool name), and a short preview (first non-empty line, truncated to ~80 chars).
- When expanded, shows full `event.content` in a `<pre>` block with wrap/break-word, matching ToolUseCard's body style.
- Default state: collapsed.

This is symmetric with ToolUseCard and keeps the visual language consistent.

### AD-2: Global expand/collapse control via shared state

Add `expandAll: boolean | null` state in `TranscriptViewer` (null = user controls individual items). Pass `forceOpen` prop to both `ToolUseCard` and `ToolResultCard`. Header buttons in `LivePage` toggle between `null → true → false → null`.

Rejected alternative: React Context. Overkill for two components; prop drilling is fine here.

### AD-3: Associate tool_result with preceding tool_use by positional adjacency

The transcript is strictly ordered: a `tool_use` assistant block is immediately followed (within a few events) by a matching `user/tool_result`. For the preview label, `ToolResultCard` receives an optional `toolName` prop derived by scanning backward in `TranscriptViewer`'s map step to find the nearest prior `tool_use` event. No ID matching needed (the stream normalizer doesn't carry `tool_use_id` through). If not found, fall back to generic "tool result" label.

### AD-4: No change to stream-utils, normalizer, or SSE route

T013 delivered a working transcript pipeline. This BL is a pure frontend/presentational change.

### AD-5: Keep ResultCard (session result) expanded

`type: "result"` events carry session-level usage/cost summaries — small and informative. These stay expanded. Only tool input/output blocks get folded.

## Files Touched

- `components/transcript-viewer.tsx` — add ToolResultCard, expand-all prop plumbing, tool-name lookback.
- `app/project/[id]/live/page.tsx` — add Expand all / Collapse all controls in the header.
- `components/__tests__/transcript-viewer.test.tsx` — new unit tests (vitest + @testing-library/react if available, else pure render snapshots). If JSDOM testing is not yet configured, fall back to a pure-logic test file covering the tool-name lookback helper.

## Sub-Tasks

### ST-1: Add ToolResultCard component with fold-by-default behavior

- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Status:** done
- **Acceptance criteria:**
  - New `ToolResultCard` function in `components/transcript-viewer.tsx` with same visual style family as `ToolUseCard` (same bg, border, rounding, hover).
  - Header shows disclosure triangle, label ("tool result" or matched tool name), and a one-line preview (first non-empty line, truncated to 80 chars with ellipsis).
  - Body collapsed by default; expands on click, showing full `event.content` in wrapped `<pre>`.
  - `TranscriptViewer`'s map dispatches `type === "user" && subtype === "tool_result"` to `ToolResultCard` instead of the generic fallback card.
  - Events that are plain user messages (`type: "user"` without `tool_result` subtype) continue to render in the generic fallback card.
- **Test strategy:** Unit test — render transcript with a tool_result event, assert body content is not in the initial DOM (or has `hidden` equivalent) and becomes visible after clicking the header.

### ST-2: Lookback helper to label tool_result with preceding tool_use name

- **Size:** S
- **Dependencies:** ST-1
- **Agent:** Dev (generic)
- **Status:** done
- **Acceptance criteria:**
  - Pure helper `findPrecedingToolName(events, index): string | null` — scans backward from `index - 1`, returns the `tool_name` of the first `assistant/tool_use` event encountered; stops and returns null if it encounters another `tool_result` first (indicating the pairing belongs to a different call).
  - `TranscriptViewer` passes the resolved name as `toolName` prop to `ToolResultCard`.
  - If null, card label falls back to "tool result".
- **Test strategy:** Unit test the pure helper across several arrangements (simple pair, nested calls interleaved with text, no match).

### ST-3: Expand all / Collapse all header controls

- **Size:** S
- **Dependencies:** ST-1
- **Agent:** Dev (generic)
- **Status:** done
- **Acceptance criteria:**
  - `TranscriptViewer` accepts optional `forceExpanded: boolean | null` prop. When `true`, both `ToolUseCard` and `ToolResultCard` open regardless of internal state; `false` forces closed; `null` lets each card manage its own state.
  - `LivePage` renders two new buttons in the existing header button row (next to Clear): "Expand all" and "Collapse all". Styled to match the existing small pill buttons.
  - Clicking a button sets a `forceExpanded` state; clicking the same button again resets to `null` (pass-through). Alternatively a simple 3-state toggle — either is acceptable, document choice in code comment.
  - Controls only visible when `hasTranscript` is true (consistent with Clear/Reconnect/Auto-scroll).
- **Test strategy:** Unit test verifying that when `forceExpanded={true}` is passed, all tool cards render body content in initial DOM; when `false`, none do.

### ST-4: Playwright visual verification

- **Size:** S
- **Dependencies:** ST-1, ST-2, ST-3
- **Agent:** QA Lead
- **Status:** done
- **Acceptance criteria:**
  - Navigate to `http://localhost:3200/project/0/live` with an active or recent haze transcript.
  - Screenshot shows: Claude text messages visible in full, thoughts visible in italic, tool_use cards collapsed, tool_result cards collapsed with preview line.
  - Click one folded tool_result; screenshot confirms body expands inline.
  - Click "Expand all"; screenshot confirms every tool card body is visible.
  - Click "Collapse all"; screenshot confirms every tool card body is hidden.
  - Save screenshots to `screenshots/bl031-*.png` and reference from the review summary.
- **Test strategy:** Manual Playwright MCP session during REVIEW phase; screenshots attached to review artifact.

## Risk & Rollback

- Risk: low. Purely presentational; no data-path changes. If ToolResultCard misrenders, the generic fallback is the current behavior — a one-line revert of the dispatch switch in `TranscriptViewer` restores it.
- Rollback: `git revert` the single commit. No migrations, no state shape changes.

## Open Questions

None (no CEO answers required — UX direction is clear from the backlog description and the existing ToolUseCard pattern sets precedent).
