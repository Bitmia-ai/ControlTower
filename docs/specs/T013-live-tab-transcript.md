# BL-013: Live tab should tail Claude transcript files

**Status:** built
**Priority:** P0
**Type:** bug

## Problem

The Live tab SSE endpoint at `app/api/projects/[id]/stream/route.ts` hardcodes the log file path to:

```
{projectPath}/.redeye/session-cto.jsonl
```

This file is only created by Control Tower's own `spawnClaudeSession()` (in `lib/claude-runner.ts`), which pipes Claude's stdout to that file. Sessions started from the CLI (via `ralph-loop` or any other method) write their transcript to a completely different location:

```
~/.claude/projects/{encoded-path}/{session-uuid}.jsonl
```

Because the `.redeye/session-cto.jsonl` file does not exist for CLI sessions, the SSE stream silently produces no data and the Live tab shows nothing.

## Architecture Decisions

### AD-1: Transcript source priority

The stream endpoint will resolve the log file to tail using the following priority:

1. **Control Tower session** — if `.redeye/session-cto.jsonl` exists and is less than 60 seconds old (actively being written), use it.
2. **CLI transcript** — find the most recently modified `.jsonl` file in `~/.claude/projects/{encoded-path}/`. Use the file with the highest mtime.
3. **No file** — stream keepalives only; client shows "Waiting for session to start..." message.

This means both start-modes work without any config or branching on the client side.

### AD-2: Claude CLI transcript event format

The CLI transcript JSONL format differs from the `stream-json` stdout format. Each line is an envelope:

```jsonl
{ "type": "assistant", "message": { "role": "assistant", "content": [...], "usage": {...} }, ... }
{ "type": "user", "message": { "role": "user", "content": "..." }, ... }
```

Key fields:
- `type` — `"assistant"`, `"user"`, `"attachment"`, `"last-prompt"`, `"permission-mode"`, `"queue-operation"`
- `message.content` — array of content blocks: `{ type: "text", text: "..." }`, `{ type: "thinking", thinking: "..." }`, `{ type: "tool_use", name: "...", input: {...} }`, `{ type: "tool_result", content: "..." }`
- `message.usage` — `{ input_tokens, output_tokens, cache_read_input_tokens }`
- `timestamp` — ISO string
- `uuid`, `sessionId`

We will add a **transcript event normalizer** (`lib/transcript-normalizer.ts`) that converts CLI transcript lines into `ClaudeStreamEvent` (the existing type used by `TranscriptViewer`). This isolates format concerns and keeps the SSE stream shape stable.

Mapping:
- `type="assistant"` with text content block → `{ type: "assistant", subtype: "text", content: "..." }`
- `type="assistant"` with thinking block → `{ type: "assistant", subtype: "thinking", content: "..." }`
- `type="assistant"` with tool_use block → `{ type: "assistant", subtype: "tool_use", tool_name: "...", tool_input: {...} }`
- `type="user"` with tool_result content → `{ type: "user", subtype: "tool_result", content: "..." }`
- `type="user"` with string/text content → `{ type: "user", content: "..." }`
- All other types (attachment, permission-mode, queue-operation) → skip (do not emit to SSE stream)

### AD-3: Path encoding

Claude CLI encodes project paths by replacing `/` with `-`. The encoded form for `/Users/casa/control-tower` is `-Users-casa-control-tower`. We compute this as:

```ts
projectPath.replace(/\//g, "-")
```

The full directory is:
```ts
path.join(os.homedir(), ".claude", "projects", projectPath.replace(/\//g, "-"))
```

### AD-4: "Most recent file" selection

Scan the directory for `*.jsonl` files excluding directories. Sort by `mtime` descending. Pick the first. Refresh the selected file if a newer one appears (rescan every 30 seconds in the polling loop, or on each watcher callback).

### AD-5: No UI changes required

The `live/page.tsx` client does not need changes. It already handles the "not running" empty state and connects via SSE when running. The fix is entirely in the server-side stream endpoint and new server-side utilities.

## Sub-tasks

### T1 — Add `lib/transcript-normalizer.ts` with unit tests
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Description:** Export `normalizeTranscriptLine(raw: string): ClaudeStreamEvent | null`. Parse a raw JSONL line from the CLI transcript envelope format, return a `ClaudeStreamEvent` or `null` to skip. Handles all content block types listed in AD-2.
- **Test strategy:** Unit tests in `lib/transcript-normalizer.test.ts` covering all branch paths: text, thinking, tool_use, tool_result, skipped types, malformed JSON.
- **Acceptance criteria:**
  - All event type mappings in AD-2 produce the correct `ClaudeStreamEvent` shape.
  - `null` returned for `attachment`, `permission-mode`, `queue-operation`, `last-prompt` types.
  - `null` returned for malformed JSON (no throw).
  - 100% branch coverage on the mapper.
- **Status:** done

### T2 — Add `lib/transcript-file-resolver.ts` with unit tests
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Description:** Export `resolveTranscriptFile(projectPath: string): string | null`. Implements the priority logic from AD-1 and AD-3: check `.redeye/session-cto.jsonl` freshness first, then scan `~/.claude/projects/{encoded}/*.jsonl` by mtime. Return the best file path, or `null` if none.
- **Test strategy:** Unit tests in `lib/transcript-file-resolver.test.ts`. Mock `fs.statSync` and `fs.readdirSync`. Test: (a) .redeye file fresh → returns it; (b) .redeye file stale, CLI files present → returns most recent CLI file; (c) neither exists → returns null; (d) path encoding is correct.
- **Acceptance criteria:**
  - Correct file returned in all three scenarios above.
  - Path encoding logic tested for paths with leading slash and nested directories.
  - No direct fs calls in tests (fully mockable).
- **Status:** done

### T3 — Update `app/api/projects/[id]/stream/route.ts`
- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (sonnet)
- **Description:** Replace the hardcoded `.redeye/session-cto.jsonl` path with a call to `resolveTranscriptFile(project.path)`. When the result is null, return a keepalive-only SSE stream. Update `createSSEStream` or the route to pass through `normalizeTranscriptLine` so that CLI transcript lines are normalized before being emitted as SSE events.
- **Test strategy:** The stream route is integration-level. Verify manually via smoke test (T5). Add a unit test to `lib/stream-utils.test.ts` verifying that `createSSEStream` accepts an optional `lineTransformer` argument and applies it.
- **Acceptance criteria:**
  - When `resolveTranscriptFile` returns null, SSE stream emits only keepalives (no error response).
  - When resolving a `.redeye` session file, raw lines pass through unchanged (backward compat).
  - When resolving a CLI transcript file, lines are normalized via `normalizeTranscriptLine` before SSE emission.
  - `null` returns from normalizer cause the line to be skipped (not emitted).
- **Status:** done

### T4 — Update `lib/stream-utils.ts` to support line transformer
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (sonnet)
- **Description:** Add an optional `lineTransformer?: (line: string) => string | null` parameter to `createSSEStream`. When provided, call it on each line before emitting; skip the line if the transformer returns null. This is pure additive — existing callers pass no transformer and see identical behavior.
- **Test strategy:** Unit tests in `lib/stream-utils.test.ts` (already exists as a test location): verify transformer is applied, null causes skip, absence of transformer emits raw line.
- **Acceptance criteria:**
  - Existing `createSSEStream(filePath)` call signature still works (backward compat).
  - `createSSEStream(filePath, { lineTransformer })` applies transformer per line.
  - null from transformer skips the SSE event for that line.
- **Status:** done

### T5 — Smoke test: Live tab shows content for CLI session
- **Size:** S
- **Dependencies:** T1, T2, T3, T4
- **Agent:** QA Lead (sonnet)
- **Description:** Write/update Playwright test or vitest integration test that verifies the stream endpoint returns data when a CLI transcript file exists. Use a fixture transcript file (a few lines of real-format JSONL). Spin up a mock or real Next.js request against the stream route.
- **Test strategy:** Integration test using a fixture `.jsonl` file placed in a temp directory. Call `resolveTranscriptFile` with a projectPath pointing to the fixture dir. Assert the right file is resolved. Optionally test SSE emission with a small pipe-based test if feasible.
- **Acceptance criteria:**
  - Test passes with a fixture CLI transcript file in the expected location.
  - Test covers both the "no file" (null) and "file found" paths.
  - `npx vitest run` passes with zero failures.
- **Status:** done

## File Map

| File | Change |
|---|---|
| `lib/transcript-normalizer.ts` | NEW — CLI transcript line → ClaudeStreamEvent mapper |
| `lib/transcript-normalizer.test.ts` | NEW — unit tests for normalizer |
| `lib/transcript-file-resolver.ts` | NEW — resolves best transcript file for a project |
| `lib/transcript-file-resolver.test.ts` | NEW — unit tests for resolver |
| `lib/stream-utils.ts` | MODIFY — add optional lineTransformer param to createSSEStream |
| `lib/stream-utils.test.ts` | NEW or MODIFY — tests for lineTransformer behavior |
| `app/api/projects/[id]/stream/route.ts` | MODIFY — use resolver + normalizer |

## Out of Scope

- Changing `live/page.tsx` (no client changes needed)
- Parsing all CLI transcript event types (only the UI-relevant ones)
- Displaying raw attachment/hook events in the transcript viewer
- Historical transcript replay (only tailing active/recent file)
