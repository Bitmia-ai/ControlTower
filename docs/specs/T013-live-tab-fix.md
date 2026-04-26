# BL-013 (Reopened) — Live Tab EventSource Must Connect for CLI Sessions

**Status:** done
**Priority:** P0 (CEO reopened)
**Iteration:** 40
**Prior specs:** earlier BL-013 plans exist under docs/specs (kept for history)

## Problem

The Live tab still shows nothing in production even though:
- The transcript resolver (`lib/transcript-file-resolver.ts`) already finds the most-recent `~/.claude/projects/-Users-casa-{slug}/*.jsonl`.
- The SSE route (`app/api/projects/[id]/stream/route.ts`) already tails that file and normalizes events.

**Root cause found during PLAN:** `app/project/[id]/live/page.tsx` only opens an `EventSource` when `running === true`. The `running` flag from `/api/projects/[id]` is computed from `getSessionStatus(project.path).cto.status` — which tracks Control Tower-spawned sessions only. CLI sessions (`claude` run by the user, or Ralph Loop) never flip `running` to true, so the client never connects, and the empty state ("No active session. Start RedEye to see live output.") is shown regardless of transcript availability.

## Architecture Decisions

### AD-1: Decouple Live tab connection from `running`

The Live tab must connect to `/api/projects/[id]/stream` whenever a recent transcript exists, not only when the CT session is running. The stream route already handles "no file" by emitting keepalives and rescanning, so it is safe to connect unconditionally.

### AD-2: New lightweight endpoint `GET /api/projects/[id]/transcript-status`

Returns `{ available: boolean, source: "redeye" | "cli" | null, mtime: string | null, ageSeconds: number | null }`. The page uses this to:
- Decide whether to show the empty state vs the viewer.
- Show a banner: "Live session" (age < 60s), "Recent transcript" (age < 10min, not running), or "No transcript yet".

This lets the UI distinguish a truly idle project from one with an active but CLI-spawned session.

### AD-3: Always-on EventSource when transcript exists

The page polls `transcript-status` every 5s (replacing the `running` poll for gating purposes; `running` is still fetched for the controls/state overlay). While a transcript is available, the EventSource stays open. If the transcript disappears, the page keeps the EventSource but displays a "waiting for new session" banner.

### AD-4: Preserve backlog of already-tailed events

If the resolver switches to a newer file (session change, already implemented via `fileResolver`), the UI should insert a separator event ("— new session —") so the user sees the transition.

### AD-5: Visual verification is blocking

Per CEO note, the fix cannot be marked done without Playwright evidence that:
- Live tab shows events while a CLI-spawned Claude session writes to its transcript.
- Live tab shows events while a CT-spawned session runs.
- Live tab shows the empty state when no transcript is < 10 minutes old.

## Sub-Task Decomposition

### T1 — Add `GET /api/projects/[id]/transcript-status` endpoint
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic, sonnet)
- **Test strategy:**
  - Vitest: mock `resolveTranscriptFile` and `fs.statSync`, verify `{ available, source, ageSeconds }` shape for all branches (no file, redeye fresh, redeye stale, cli recent, cli old).
- **Acceptance:**
  - 200 JSON response on happy path.
  - 404 when project index invalid.
  - `source` is `"redeye"` for `.redeye/session-cto.jsonl`, `"cli"` otherwise.
- **Status:** done

### T2 — Update `live/page.tsx` to gate on transcript availability, not `running`
- **Size:** M
- **Dependencies:** T1
- **Agent:** Dev (generic, sonnet)
- **Test strategy:**
  - Vitest component test with mocked `fetch` and `EventSource`: assert EventSource opens when transcript-status returns `available: true`, closes when it goes false.
  - Assert the banner text variants for `redeye` / `cli` / `null`.
- **Acceptance:**
  - EventSource opens whenever `available === true`, independent of `running`.
  - Empty state only shown when `available === false` AND `running === false`.
  - Existing Auto-scroll, Reconnect, Clear controls still render and behave unchanged.
  - No duplicate EventSources if poll fires mid-connection.
- **Status:** done

### T3 — "New session" separator on file-switch
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic, sonnet)
- **Test strategy:**
  - Unit: when stream emits a sentinel event (`{ type: "__session_boundary__" }`) or when the page detects the transcript-status `mtime` moving backward relative to last event, inject a divider row in `TranscriptViewer`.
  - Prefer server-side sentinel: stream route emits `data: {"type":"__session_boundary__","path":"..."}\n\n` inside the `fileResolver` switch branch of `createSSEStream`.
- **Acceptance:**
  - When the tailed file changes, a single "— New session —" row appears in the viewer.
  - No duplicate boundaries when rescan returns the same path.
- **Status:** done

### T4 — Playwright visual verification (BLOCKING per CEO)
- **Size:** M
- **Dependencies:** T2, T3
- **Agent:** QA Lead (sonnet)
- **Test strategy:**
  - Scenario A: start a `claude --print "hi"` against `haze` from CLI while Live tab open → assert events render within 15s; screenshot `bl013-live-cli.png`.
  - Scenario B: start Control Tower session via Start button → assert events render; screenshot `bl013-live-ct.png`.
  - Scenario C: delete/rename all transcripts, reload → assert empty state copy; screenshot `bl013-live-empty.png`.
  - Record console for errors; fail test if any unhandled error logs.
- **Acceptance:**
  - All 3 screenshots saved under `screenshots/`.
  - Each scenario shows the expected state within 15s.
- **Status:** done

### T5 — Regression: existing stream route tests still pass
- **Size:** S
- **Dependencies:** T1–T3
- **Agent:** Dev (generic, sonnet)
- **Test strategy:** run `npx vitest run` and `npm run build`; fix any drift caused by the boundary-event addition.
- **Acceptance:** green vitest, green build.
- **Status:** done

## Total: 5 sub-tasks (2 S, 3 M). Estimated effort: one BUILD cycle.

## Risks

- EventSource keeps retrying on error; combined with the always-on connect, we could create reconnect storms if the stream route throws. Mitigation: keep the `onerror` handler that sets `connected=false` and only auto-reconnect via the poll, not in `onerror`.
- `transcript-status` hits the filesystem every 5s per open tab. Cost is negligible (single `readdirSync` + `statSync`) but we should cap concurrent polls per project. Not blocking.

## Out of Scope

- Historical transcript viewer when no session is running (Q-003 answered "no").
- Redesign of TranscriptViewer — reuse as-is.
- Any change to the session-manager's definition of `running`.
