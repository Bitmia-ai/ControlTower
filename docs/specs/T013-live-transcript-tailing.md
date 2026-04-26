# T013: Live tab should tail Claude transcript files

**Status:** planned
**Priority:** P0 (bug)
**Iteration:** 22

## Problem

The Live tab SSE stream route (`/api/projects/[id]/stream`) reads from `.redeye/session-cto.jsonl`, a file that only exists when Control Tower spawns sessions via its own session manager. Sessions started from CLI (including the ralph-loop stop hook) use Claude's native transcript files stored at `~/.claude/projects/`. This makes the Live tab non-functional for the primary use case.

## Architecture Decisions

1. **Read Claude native transcripts directly.** The stream route will resolve the Claude transcript directory for a project by converting its absolute path to the Claude slug format (replacing `/` with `-`, stripping the leading `-`). The directory pattern is `~/.claude/projects/{slug}/`.

2. **Find the most recent transcript by mtime.** Within the Claude projects directory, select the `.jsonl` file with the most recent modification time. This represents the active or most recent session.

3. **Translate Claude transcript format to ClaudeStreamEvent.** Claude's native JSONL has a different schema than our `ClaudeStreamEvent` type. We need a translation layer in a new utility (`lib/transcript-adapter.ts`) that maps Claude's `type`/`message` fields to our existing `ClaudeStreamEvent` interface. The key types to map: `assistant` (with subtypes text/thinking/tool_use), `tool_result`, and `result`.

4. **Keep stream-utils generic.** The existing `tailJsonl` and `createSSEStream` in `lib/stream-utils.ts` remain file-agnostic. The adaptation happens in the route or a new helper that wraps the raw JSONL line into a `ClaudeStreamEvent`.

5. **Fallback chain.** The stream route should try (a) the Claude native transcript first, then (b) `.redeye/session-cto.jsonl` as fallback. This keeps backward compatibility if session-cto.jsonl is ever used again.

6. **Remove dependency on session "running" status for showing transcript.** The Live page currently gates SSE connection on `running === true`. Since we can now tail transcripts from Claude's own files, we should also allow viewing the most recent transcript even when no session is actively running (with a note that it is historical). However, for this bug fix we keep the current running-gate behavior and just fix the file path.

## Sub-tasks

### T1: Create transcript path resolver
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Description:** Create `lib/claude-transcript.ts` with:
  - `getClaudeTranscriptDir(projectPath: string): string` -- converts project path to Claude slug directory
  - `findLatestTranscript(projectPath: string): string | null` -- finds the most recent `.jsonl` file by mtime in the Claude transcript directory
- **Test strategy:** Unit test with mocked fs. Test slug conversion for various paths (e.g., `/Users/casa/control-tower` -> `-Users-casa-control-tower`). Test that it returns the newest file when multiple exist, and null when directory is empty/missing.
- **Acceptance criteria:**
  - Correctly converts project paths to Claude transcript directory paths
  - Returns the most recent `.jsonl` file by mtime
  - Returns null gracefully when no transcripts exist
- **Status:** pending

### T2: Create transcript format adapter
- **Size:** M
- **Dependencies:** none (can run in parallel with T1)
- **Agent:** Dev (generic)
- **Description:** Create `lib/transcript-adapter.ts` with:
  - `adaptClaudeLine(rawLine: string): ClaudeStreamEvent | null` -- parses a raw JSONL line from Claude's native transcript and maps it to a `ClaudeStreamEvent`
  - Map Claude native types: `assistant` -> extract `message.content` blocks (text, thinking, tool_use), `tool_result` -> tool_result subtype, skip non-displayable types (queue-operation, attachment, hook_success, etc.)
- **Test strategy:** Unit test with real sample JSONL lines captured from `~/.claude/projects/`. Test each message type mapping. Test that non-displayable types return null. Test malformed JSON returns null.
- **Acceptance criteria:**
  - Correctly maps assistant text, thinking, and tool_use content blocks
  - Filters out non-displayable event types (returns null)
  - Handles malformed JSON gracefully
- **Status:** pending

### T3: Update stream route to use Claude transcripts
- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (generic)
- **Description:** Update `app/api/projects/[id]/stream/route.ts`:
  - Import `findLatestTranscript` and `adaptClaudeLine`
  - Try to resolve the Claude transcript file first via `findLatestTranscript(project.path)`
  - Fall back to `.redeye/session-cto.jsonl` if no Claude transcript found
  - When using Claude transcript, wrap the `tailJsonl` callback to call `adaptClaudeLine` and skip null results
  - Update `createSSEStream` or create `createAdaptedSSEStream` that applies the adapter
- **Test strategy:** Integration test: mock the file system, verify the route resolves the correct file. Manual E2E: start the dev server, navigate to Live tab, verify events render.
- **Acceptance criteria:**
  - Stream route serves events from Claude's native transcript files
  - Falls back to session-cto.jsonl when no Claude transcript exists
  - Events are correctly formatted as ClaudeStreamEvent for the frontend
- **Status:** pending

### T4: Add createAdaptedSSEStream to stream-utils
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic)
- **Description:** Add a new export `createAdaptedSSEStream(filePath: string, adapter: (line: string) => object | null): ReadableStream<Uint8Array>` to `lib/stream-utils.ts`. This wraps `tailJsonl` but applies the adapter function to each line, skipping nulls. This keeps stream-utils reusable while supporting format translation.
- **Test strategy:** Unit test with a mock adapter function. Verify that null returns from the adapter are skipped. Verify SSE format output.
- **Acceptance criteria:**
  - Adapted stream filters out null adapter results
  - SSE format is correct (data: {json}\n\n)
  - Keepalive comments still sent
- **Status:** pending

### T5: E2E verification and build check
- **Size:** S
- **Dependencies:** T3, T4
- **Agent:** QA Lead
- **Description:** Run `npm run build` to verify no type errors. Run `npx vitest run` to verify all tests pass. Manually verify the Live tab works with the dev server if possible.
- **Test strategy:** Build check + test suite run.
- **Acceptance criteria:**
  - `npm run build` passes
  - `npx vitest run` passes with no regressions
  - No TypeScript errors
- **Status:** pending
