# BL-053: Improve session history page — show phase timeline and cost per session

**Status:** planned  
**Priority:** P2  
**Type:** feature  
**Added:** 2026-04-25 (iter 79)  
**Spec written:** 2026-04-25 (iter 83)

---

## Problem

The history page at `/project/[id]/history` currently renders a plain changelog timeline parsed from `.redeye/changelog.md`. Each entry is an iteration row with a title and freeform markdown body — there is no per-session cost, no phase breakdown, and no visual phase chip timeline. Users cannot see at a glance how much each session cost or which phases ran.

---

## Architecture Decisions

### AD-1: Dual-panel design — keep changelog timeline, add session cost panel

The page currently has a single `TimelineEntry` list. We preserve the changelog view (it is already functional and useful) and add a second section above it: a **"Sessions"** table that shows each JSONL transcript file as one row. Rows display cost, start date, duration, and a mini phase chip strip.

The changelog section is renamed "Iteration Log" and remains unchanged beneath the sessions section, separated by a heading.

This avoids a full page rewrite and degrades gracefully: if no transcript files exist the sessions section shows the existing `EmptyState` component; if changelog is empty it shows its own empty state.

### AD-2: Session data comes from `GET /api/projects/[id]/cost-history` — extend, do not duplicate

`lib/cost-history.ts` already enumerates `~/.claude/projects/{encoded}/*.jsonl`, stats each file, and sums cost via `sumTranscriptFileCost`. The existing endpoint returns `{ file, cost, mtimeMs }`. We extend the response shape to also include:

- `startedAt: number` — derived from the first line's timestamp in the JSONL file (fallback: `mtimeMs`)
- `durationMs: number` — `mtimeMs - startedAt` (approximate; limited to file mtime resolution)
- `phases: string[]` — ordered list of distinct phase names observed in the session

The extended shape is `SessionHistoryEntry`. Existing consumers (`CostCard`/`SparklineChart`) use only `{ file, cost, mtimeMs }` — they are unaffected because the response is a strict superset.

### AD-3: Phase extraction from JSONL via a new `extractSessionPhases` function in `lib/cost-history.ts`

The JSONL transcript files contain `system` envelope lines that include phase-change markers. Observation from the existing `ClaudeStreamEvent` type: assistant messages and user messages are the main content. Phase changes appear as system-type user messages from the orchestrator with text like `"Entering PLAN phase"` or `"phase: BUILD"`.

Since the exact log format is implementation-dependent and the transcript files belong to the Claude CLI (not Control Tower), we use a **best-effort scan**: read each JSONL line, look for the pattern `/(?:phase[:\s]+|entering\s+)(TRIAGE|PLAN|BUILD|REVIEW|DEPLOY|VERIFY|MERGE|HARDEN|STABILIZE|INCORPORATE)/gi` in `content` or message text fields, and collect distinct phase names in encounter order.

This is fault-tolerant: if the pattern matches zero phases, `phases` is `[]` and the UI shows no chips (graceful degradation). No new npm dependency is required.

### AD-4: `lib/cost-history.ts` extended — `getSessionHistory` replaces `getSessionCostHistory`

We add a new export `getSessionHistory(projectPath, limit?)` that returns `SessionHistoryEntry[]` (the richer shape). The existing `getSessionCostHistory` function is kept for backward compatibility (still used internally by the existing `cost-history` route). The new `getSessionHistory` calls the same file-enumeration code then additionally calls `extractSessionPhases` per file.

**No new lib file** — everything lives in `lib/cost-history.ts` which already owns this domain. Keeps the surface area small.

### AD-5: New API endpoint `GET /api/projects/[id]/session-history/route.ts`

A dedicated endpoint to avoid breaking the existing `cost-history` route contract. Returns:

```json
{
  "data": {
    "sessions": [
      {
        "file": "abc-123.jsonl",
        "cost": 1.42,
        "mtimeMs": 1714000000000,
        "startedAt": 1713999900000,
        "durationMs": 100000,
        "phases": ["TRIAGE", "PLAN", "BUILD", "REVIEW", "DEPLOY"]
      }
    ]
  }
}
```

Sessions sorted ascending by `mtimeMs` (oldest first), no hard limit (show all sessions). The `limit` parameter is exposed as an optional query param `?limit=N` for future pagination; default is 50.

### AD-6: UI — `SessionHistoryRow` component in `components/history/session-history-row.tsx`

A single client component (extracted from the page) that renders one session row:

- **Date/time:** formatted from `startedAt` (e.g., "Apr 24, 3:41 PM")
- **Duration:** formatted from `durationMs` (e.g., "1h 42m" or "< 1min")
- **Cost badge:** `$X.XX` in a subtle secondary pill, red accent
- **Phase chip strip:** horizontal row of `<PhaseChip>` components, one per phase in `phases[]`, using `PHASE_COLORS` from `redeye-types.ts`. Max 8 chips visible; any beyond 8 are truncated with `+N more`.

If `phases` is empty, the chip strip shows a single gray `—` chip labeled "No phase data".

### AD-7: `components/history/phase-chip.tsx` — reusable phase chip

A tiny presentational component: accepts `phase: string`, looks up `PHASE_COLORS[phase]`, and renders a small rounded pill with the phase short-label. Used in the session row and importable elsewhere.

This does **not** conflict with the existing `PhaseBadge` component, which shows the *current* active phase with a pulsing dot. `PhaseChip` is static and used in the historical timeline.

### AD-8: Page refactor — `app/project/[id]/history/page.tsx`

The page remains `"use client"`. We add a second `useState` / `useEffect` for session history data (`GET /api/projects/[id]/session-history`). Both data fetches run in parallel via `Promise.all`. Loading and error states are handled per-section independently.

The page layout:

```
<main>
  <section aria-label="Sessions">
    <h2>Sessions</h2>
    {sessions.map(s => <SessionHistoryRow />)}
  </section>

  <section aria-label="Iteration Log">
    <h2>Iteration Log</h2>
    {changelog.map(e => <TimelineEntry />)}
  </section>
</main>
```

### AD-9: Dark/light mode

All new components use Tailwind `dark:` variants. `PHASE_COLORS` already defines dark-mode values for each phase. Cost badge uses `bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400`. Session rows use standard `bg-white dark:bg-zinc-900` or transparent backgrounds matching the existing card aesthetic.

### AD-10: No new npm dependencies

Phase extraction is regex-based on raw text. Date formatting uses `Intl.DateTimeFormat` (available everywhere). Duration formatting is manual arithmetic. All within the no-new-dependency constraint.

---

## Sub-task Decomposition

### T1 — Extend `lib/cost-history.ts`: add `SessionHistoryEntry`, `extractSessionPhases`, `getSessionHistory`
- **Size:** S
- **Dependencies:** none (builds on existing `sumTranscriptFileCost`, `encodeProjectPath`)
- **Agent type:** Dev (sonnet)
- **Description:**
  1. Add `export interface SessionHistoryEntry` with fields `{ file, cost, mtimeMs, startedAt, durationMs, phases }`.
  2. Add `export async function extractSessionPhases(filePath: string): Promise<string[]>` — reads the JSONL file line by line, applies the phase-detection regex against message text fields, returns distinct ordered phase names. Returns `[]` on any error (never throws).
  3. Add `export async function getSessionHistory(projectPath: string, limit?: number): Promise<SessionHistoryEntry[]>` — enumerates files (same as `getSessionCostHistory`), for each file concurrently computes cost + phases + reads first-line timestamp for `startedAt`, returns `SessionHistoryEntry[]` sorted ascending by `mtimeMs`, sliced to `limit` (default 50).
  4. Keep existing `getSessionCostHistory` and `SessionCostEntry` exports unchanged.
- **Test strategy:** Unit tests in `lib/cost-history.test.ts` (existing file):
  - `extractSessionPhases`: empty file → `[]`; file with no matching text → `[]`; file with `"Entering PLAN phase"` → `["PLAN"]`; file with multiple phases in order → ordered distinct list; malformed JSONL lines → gracefully skipped.
  - `getSessionHistory`: zero files → `[]`; one file → entry with correct shape; phases populated from content; `limit` respected; sorted ascending by `mtimeMs`.
- **Acceptance criteria:**
  - `SessionHistoryEntry` type exported from `lib/cost-history.ts`
  - `extractSessionPhases` returns `[]` on any error (no throw)
  - `getSessionHistory` returns sessions sorted ascending by `mtimeMs`
  - Existing `getSessionCostHistory` still works and all its existing tests pass
  - New unit tests pass
- **Status:** done

### T2 — `GET /api/projects/[id]/session-history/route.ts`: new endpoint
- **Size:** S
- **Dependencies:** T1
- **Agent type:** Dev (sonnet)
- **Description:** New App Router route handler at `app/api/projects/[id]/session-history/route.ts`. Resolves project by `[id]` index, reads optional `?limit` query param (parseInt, default 50), calls `getSessionHistory(project.path, limit)`, returns `{ data: { sessions: SessionHistoryEntry[] } }`. Wraps in try-catch per BL-025 pattern. Returns 404 if project not found.
- **Test strategy:** Unit test `app/api/projects/[id]/session-history/route.test.ts`:
  - Project not found → 404
  - Empty sessions → 200 `{ data: { sessions: [] } }`
  - Happy path → 200 with correct payload shape and sorted sessions
  - Thrown error → 500 `{ error: "..." }`
  - `?limit=3` → passes limit to `getSessionHistory`
- **Acceptance criteria:**
  - Route at `app/api/projects/[id]/session-history/route.ts`
  - Response shape matches `SessionHistoryEntry[]` contract
  - try-catch with `{ error }` on failure
  - All unit tests pass
- **Status:** done

### T3 — `components/history/phase-chip.tsx`: small phase pill component
- **Size:** S
- **Dependencies:** none (reads `PHASE_COLORS` from `redeye-types`)
- **Agent type:** Dev (sonnet)
- **Description:** Pure presentational component. Props: `phase: string`. Renders a `<span>` with `bg` and `text` classes from `PHASE_COLORS[phase]`, falling back to gray if the phase is not in the map. Short label: first 3 chars of phase name (e.g., `TRI`, `PLN`, `BLD`, `REV`, `DEP`, `VER`, `MRG`), or use a `PHASE_SHORT_LABELS` map for readability. Full phase name shown as `title` tooltip. No animation (static historical chip).
- **Test strategy:** Unit test `components/history/phase-chip.test.tsx`:
  - Known phase (e.g., `BUILD`) → applies `PHASE_COLORS.BUILD.bg` class
  - Unknown phase → renders with fallback gray classes
  - Renders the short label text
  - Has `title` attribute set to full phase name
- **Acceptance criteria:**
  - Renders correct color classes for known phases
  - Graceful fallback for unknown phase strings
  - `title` tooltip contains full phase name
  - Dark mode classes included (inherits from `PHASE_COLORS`)
  - Unit tests pass
- **Status:** in-progress

### T4 — `components/history/session-history-row.tsx`: session row component
- **Size:** M
- **Dependencies:** T3
- **Agent type:** Dev (sonnet)
- **Description:** Client component rendering one `SessionHistoryEntry` as a table row or card row. Layout:
  - Left column: formatted date (`Intl.DateTimeFormat` with `{ dateStyle: "medium", timeStyle: "short" }`) and duration string helper (`formatDuration(ms: number): string` — returns `"< 1 min"`, `"42 min"`, `"1h 23m"`, etc.).
  - Center: phase chip strip — renders `<PhaseChip>` for each entry in `phases[]`. Max 8 chips; if more, renders `+N more` label. If `phases` is empty, renders a single `"—"` gray indicator.
  - Right column: cost badge — `$X.XX` formatted with `toFixed(4)` trimmed appropriately (show 2 decimal places unless < $0.01 in which case show 4); uses red accent pill.
  - The row has a bottom border separator matching the existing changelog entry aesthetic (`border-b border-gray-100 dark:border-zinc-800`).
  - Accessible: the phase chip strip has `aria-label="Phases: PLAN BUILD REVIEW"` assembled from the phases array.
- **Test strategy:** Unit test `components/history/session-history-row.test.tsx`:
  - Renders date formatted from `startedAt`
  - Renders duration correctly for various `durationMs` values (0, 60000, 3900000)
  - Renders cost as `$1.42` for `cost: 1.42`
  - Renders correct number of `PhaseChip` components
  - Truncates phases at 8 with `+N more` label
  - Shows `"—"` when `phases` is `[]`
  - `aria-label` on chip strip contains phase names
- **Acceptance criteria:**
  - Date, duration, cost, phase chips all rendered correctly
  - Phase truncation at 8 with overflow label
  - Empty-phases graceful state
  - Accessible chip strip aria-label
  - Dark/light mode correct via Tailwind dark: variants
  - All unit tests pass
- **Status:** pending

### T5 — Refactor `app/project/[id]/history/page.tsx`: add sessions section
- **Size:** M
- **Dependencies:** T2, T4
- **Agent type:** Dev (sonnet)
- **Description:** Refactor the existing history page to add the sessions section above the changelog.
  1. Add `sessions` state (`SessionHistoryEntry[] | null`, initially `null`).
  2. Add `sessionsError` state (`string | null`).
  3. In `fetchDetail`, also fetch `/api/projects/${id}/session-history` in parallel (`Promise.all`). On failure, set `sessionsError` but do not affect the changelog section.
  4. Render a `<section>` with heading "Sessions" above the existing changelog section. When `sessions === null` (loading), show an inline loading skeleton (3 gray placeholder rows). When `sessionsError` and `sessions === null`, show `<FetchError message={sessionsError} />` only for this section. When `sessions.length === 0`, show `<EmptyState title="No sessions found" subtitle="Sessions will appear here once a RedEye session has run." />`. Otherwise map `sessions` (most-recent first — reverse the ascending-sorted array) to `<SessionHistoryRow>` components.
  5. Rename the existing changelog section heading to "Iteration Log".
  6. The changelog section fetch and display logic is unchanged.
- **Test strategy:** (TypeScript compile + manual E2E verification — no new unit test file needed for the page itself since the components are tested in T4):
  - `npm run build` exits 0
  - `npx vitest run` all pass
  - Playwright snapshot: sessions section renders, phase chips visible
- **Acceptance criteria:**
  - Sessions section renders above the changelog section
  - Loading state shows placeholder rows, not a spinner (matches page aesthetic)
  - Error in session-history fetch does not break changelog display
  - Sessions displayed newest-first
  - "Iteration Log" heading present
  - Build clean, all tests pass
- **Status:** pending

### T6 — Playwright E2E: session history page renders sessions and phase chips
- **Size:** S
- **Dependencies:** T5
- **Agent type:** QA Lead (sonnet)
- **Description:** Add `tests/e2e/session-history.spec.ts`. Navigates to `/project/0/history`, intercepts `GET /api/projects/0/session-history` to return a mocked payload of 3 sessions with varying costs and phases. Asserts:
  - "Sessions" heading is visible
  - 3 session rows are rendered
  - At least one `PhaseChip` is visible (e.g., text "PLN" or equivalent short label)
  - At least one cost badge is visible matching the mocked cost value
  - "Iteration Log" heading is visible (verifying changelog section still present)
- **Test strategy:** `page.route()` for mock; standard Playwright `locator()` assertions.
- **Acceptance criteria:**
  - "Sessions" heading visible in DOM
  - Session row count matches mocked data
  - Phase chips present (not empty)
  - Cost badge present
  - Test passes against `http://localhost:3200`
- **Status:** pending

### T7 — Unit test coverage gate and TypeScript clean
- **Size:** S
- **Dependencies:** T1–T6
- **Agent type:** Dev (sonnet)
- **Description:** Quality gate. Run `npx vitest run` and `npm run build`. Fix any TypeScript errors. No new implementation — verification only.
- **Test strategy:** `npx vitest run` must exit 0; `npm run build` must exit 0.
- **Acceptance criteria:**
  - All tests pass (550+ from BL-052 baseline)
  - No new TypeScript errors introduced
  - Build exits 0
- **Status:** pending

---

## Data Flow Diagram

```
/project/[id]/history (page.tsx — "use client")
  ├── fetch /api/projects/{id}                     → ProjectDetail (changelog)
  │     └── readChangelog()  [lib/redeye-files.ts]
  │           └── parseChangelog()  [lib/redeye-parsers.ts]
  │
  └── fetch /api/projects/{id}/session-history     → SessionHistoryEntry[]
        └── session-history/route.ts
              └── getSessionHistory(projectPath)   [lib/cost-history.ts]
                    ├── encodeProjectPath()         [lib/transcript-file-resolver.ts]
                    ├── sumTranscriptFileCost()     [lib/cost-calculator.ts]
                    └── extractSessionPhases()     [lib/cost-history.ts — new]
                          └── readline scan of ~/.claude/projects/{encoded}/*.jsonl
```

---

## Key Files

| File | Action |
|------|--------|
| `lib/cost-history.ts` | Modified — add `SessionHistoryEntry`, `extractSessionPhases`, `getSessionHistory` |
| `lib/cost-history.test.ts` | Modified — add tests for new exports |
| `app/api/projects/[id]/session-history/route.ts` | New — REST endpoint |
| `app/api/projects/[id]/session-history/route.test.ts` | New — unit tests |
| `components/history/phase-chip.tsx` | New — phase pill presentational component |
| `components/history/phase-chip.test.tsx` | New — unit tests |
| `components/history/session-history-row.tsx` | New — session row component |
| `components/history/session-history-row.test.tsx` | New — unit tests |
| `app/project/[id]/history/page.tsx` | Modified — add sessions section |
| `tests/e2e/session-history.spec.ts` | New — Playwright E2E |

---

## Open Questions

None. All decisions can proceed with confidence to defaults. The "no new npm dependency" constraint is satisfied by AD-10. Dark/light mode is satisfied by AD-9. The phase extraction approach (AD-3) is explicitly best-effort/graceful — no CEO input needed on format risk.

---

## Risks

- **Risk 1:** JSONL phase-detection regex may match zero phases for recent sessions if the log format differs from the expected pattern. Mitigated: `phases: []` renders a `"—"` indicator gracefully; no error state.
- **Risk 2:** Large number of JSONL files (100+) could slow the session-history endpoint since each file is read line-by-line for phase extraction. Mitigated: default `limit=50` caps I/O; phases are extracted concurrently via `Promise.all`; readline-based streaming keeps memory bounded. Acceptable for the dashboard's non-critical use case.
- **Risk 3:** The `startedAt` heuristic (first line timestamp) may be inaccurate for some transcript formats. Mitigated: falls back to `mtimeMs` silently; duration displayed as approximate.
