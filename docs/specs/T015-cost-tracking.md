# T015: Show Cost Tracking on Mission Control

**Status:** in-progress  
**Priority:** P1  
**Type:** feature

---

## Problem

Control Tower operators have no visibility into how much API spend each project is accumulating. Claude transcript JSONL files contain token usage data in every `assistant` event, but this data is never surfaced in the dashboard.

---

## Architecture Decisions

### AD-1: Cost Source — Token Usage in Assistant Events (Not cost_usd)

The Claude CLI transcript format does **not** emit a `cost_usd` field. Investigation of real transcript files confirmed the format uses:

```json
{
  "type": "assistant",
  "message": {
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 13673,
      "cache_read_input_tokens": 15508,
      "output_tokens": 144
    }
  }
}
```

Cost must be computed from token counts using published Anthropic model pricing. We hardcode Sonnet pricing (the model used by RedEye):

| Token type                      | Per-million USD |
|---------------------------------|-----------------|
| input_tokens                    | $3.00           |
| cache_creation_input_tokens     | $3.75           |
| cache_read_input_tokens         | $0.30           |
| output_tokens                   | $15.00          |

This is approximated — model version differences may vary slightly. We label it "est." in the UI to set expectations.

### AD-2: Cost Scope — Two Numbers

- **Session cost:** sum of all token costs in the **currently active transcript file** (the one resolved by `resolveTranscriptFile`).
- **Total cost:** sum across **all** JSONL files in `~/.claude/projects/{encoded}/`.

Both are computed server-side on-demand (not streamed). The session cost updates in real-time via polling.

### AD-3: Delivery — New API Endpoint + Polling

Cost parsing is server-side only — reading JSONL files is an I/O-bound Node.js operation, not appropriate for the browser. A new API route `GET /api/projects/[id]/cost` returns `{ session: number, total: number }`.

The mission control page polls this endpoint on a 10-second interval (matching the existing 5-second project detail poll cadence is too frequent for file scanning; 10s is a reasonable compromise). When the session is not running, polling pauses to avoid unnecessary I/O.

We do **not** route cost through the SSE stream. The stream carries live transcript events; cost is a derived aggregate, not an event type. Mixing them would complicate the stream consumer and the normalizer.

### AD-4: Persistent Total — Accumulate Across All Transcript Files

`resolveTranscriptFile` returns only the most-recent file. For total cost we scan all `*.jsonl` files under `~/.claude/projects/{encoded}/`. Each file is read fully. Files are not cached between requests (they grow as sessions run); this is acceptable for the polling cadence.

### AD-5: Cost Storage in BacklogItem — Optional cost_usd Field

To show cost per shipped item in the Recently Shipped card and backlog detail page, we store a `cost_usd` field in `BacklogItem`. This field is **not** written to backlog.md (that file is agent-managed). Instead, it is computed at render time: when a backlog item transitions to `done`, the cost incurred during the active session for that iteration is associated with it via state.json.

**Simpler scoped approach:** For the initial implementation, we omit per-item cost attribution from backlog detail pages. The complexity of mapping transcript time ranges to backlog items is disproportionate to the value. We focus on:
1. Session cost and total cost on mission control (core ask)
2. A "Cost so far" display in the HealthCard or a new CostCard on mission control

Per-item cost can be added as a separate backlog item in a future iteration.

### AD-6: UI Placement — New CostCard Component

A new `CostCard` component is added to the mission control grid. It shows:
- "This session: $X.XX (est.)"
- "Total: $XX.XX (est.)"
- A subtle "Updates every 10s" note when session is running
- Skeleton/loading state on first load

The card sits between `HealthCard` and `QuestionsCard` in the grid layout.

---

## Sub-Tasks

### T1: `lib/cost-calculator.ts` — Token-to-USD calculation utility
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Description:** Pure function `calculateCostUsd(usage: TokenUsage): number` using hardcoded Sonnet pricing. Includes a `sumTranscriptFileCost(filePath: string): Promise<number>` that reads a JSONL file and sums all assistant event costs.
- **Test strategy:** Unit tests with mock token counts, verify math. Test with a file that has no assistant events returns 0.
- **Acceptance criteria:**
  - `calculateCostUsd({ input_tokens: 1_000_000, output_tokens: 0, ... })` returns 3.00
  - `calculateCostUsd({ output_tokens: 1_000_000, ... })` returns 15.00
  - Handles missing fields (undefined counts as 0)
  - `sumTranscriptFileCost` reads real JSONL, returns a number
- **Status:** done

### T2: `app/api/projects/[id]/cost/route.ts` — Cost API endpoint
- **Size:** S
- **Dependencies:** T1, `transcript-file-resolver.ts` (existing)
- **Agent:** Dev (generic)
- **Description:** `GET /api/projects/[id]/cost` returns `{ data: { session: number, total: number } }`. Session cost = sum of current transcript file. Total = sum across all `*.jsonl` files in the project's Claude directory.
- **Test strategy:** Unit test with mocked fs calls. Integration: hit `/api/projects/0/cost` against running dev server, verify numeric response.
- **Acceptance criteria:**
  - Returns `{ data: { session: number, total: number } }` with HTTP 200
  - Returns `{ data: { session: 0, total: 0 } }` when no transcript files exist
  - Returns 404 if project not found
  - `total` >= `session` always
- **Status:** done

### T3: `components/mission-control/cost-card.tsx` — CostCard UI component
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic)
- **Description:** React client component that polls `/api/projects/[id]/cost` every 10 seconds. Shows session and total cost formatted as `$X.XX`. Uses a skeleton shimmer on initial load. Polling pauses when `running === false`. Follows existing card design patterns from `health-card.tsx`.
- **Test strategy:** Render test: mount with mock fetch, verify cost values display. Verify polling stops when running=false.
- **Acceptance criteria:**
  - Displays "This session: $X.XX (est.)" and "Total: $XX.XX (est.)"
  - Shows loading skeleton on first fetch
  - When session is not running, shows cost with "(session ended)" note instead of "updates every 10s"
  - Graceful error state: if fetch fails, shows last known value with a "refresh" link
- **Status:** done

### T4: Wire CostCard into mission control page
- **Size:** S
- **Dependencies:** T3
- **Agent:** Dev (generic)
- **Description:** Import and render `CostCard` in `app/project/[id]/page.tsx`. Place it after `HealthCard` in the grid. Pass `projectId` and `running` props.
- **Test strategy:** Build verification (`npm run build`). Manual smoke test at `/project/0` confirms card renders.
- **Acceptance criteria:**
  - Card appears in mission control grid
  - No TypeScript errors
  - Build passes
- **Status:** done

### T5: Update `transcript-normalizer.ts` to expose usage from assistant events
- **Size:** S
- **Dependencies:** none (parallel with T1)
- **Agent:** Dev (generic)
- **Description:** The normalizer currently discards `message.usage` from assistant events. Extend the `ClaudeStreamEvent` type's `usage` field to include `cache_creation_input_tokens` (already partially typed). This is a prerequisite if we ever want real-time cost via SSE, and it keeps the type accurate. No behaviour change in the cost card (which uses the REST API, not SSE).
- **Test strategy:** Update existing normalizer tests to verify usage is passed through correctly.
- **Acceptance criteria:**
  - `normalizeTranscriptLine` on an assistant message preserves `usage` (input, output, cache creation, cache read token counts)
  - Existing tests still pass
- **Status:** done

### T6: Vitest unit tests for T1 and T2
- **Size:** S
- **Dependencies:** T1, T2
- **Agent:** Dev (generic / QA)
- **Description:** Write `lib/cost-calculator.test.ts` and `app/api/projects/[id]/cost/route.test.ts`. Verify edge cases: empty file, file with only non-assistant lines, large token counts, missing fields.
- **Test strategy:** Run `npx vitest run` — all pass.
- **Acceptance criteria:**
  - 100% of new functions covered
  - All tests pass
- **Status:** done

---

## Out of Scope (This Iteration)

- Per-backlog-item cost attribution (future BL)
- Cost display in Recently Shipped card or backlog detail page
- Model auto-detection (pricing is hardcoded for Sonnet)
- Cost alerts or budget caps

---

## Questions Posted

None — sufficient context to proceed with defaults.
