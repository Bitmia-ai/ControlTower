# BL-051: Cost analytics — add cumulative cost chart to mission control

**Status:** planned  
**Priority:** P2  
**Type:** feature  
**Added:** 2026-04-25 (iter 79)  
**Spec written:** 2026-04-25 (iter 81)

---

## Problem

The Cost card on mission control shows two scalar values — "this session (est.)" and "total (est.)" — but gives no sense of trend. Users cannot tell whether costs are accelerating, stable, or declining across sessions without manually cross-referencing session history. A per-session sparkline showing the last 10 sessions fills this gap at a glance.

---

## Architecture Decisions

### AD-1: Pure SVG sparkline, no new npm dependency

`package.json` has no charting library. `recharts` is not present. Adding a full charting library for a single sparkline is disproportionate. We implement a self-contained `<SparklineChart>` SVG component in `components/mission-control/sparkline-chart.tsx`. It accepts a `number[]` of cost values and renders a polyline with axis labels. This keeps the bundle unchanged and respects the backlog constraint.

### AD-2: New API endpoint `GET /api/projects/[id]/cost-history`

The existing `GET /api/projects/[id]/cost` returns only session+total scalars. Rather than bloating that response, we add a dedicated endpoint that returns `{ data: { sessions: Array<{ file: string, cost: number, mtimeMs: number }> } }` sorted by mtime ascending, capped at the last 10 files. This mirrors the pattern in cost/route.ts: enumerate `~/.claude/projects/{encoded}/*.jsonl`, stat each, sum via `sumTranscriptFileCost`, sort by mtime, slice to last 10.

The `file` field is the basename only (not full path) for display purposes. `mtimeMs` enables the client to format a relative date label (e.g., "Apr 24").

### AD-3: CostCard enhancement — sparkline rendered inline below the scalars

`CostCard` is already a `"use client"` component with its own `useEffect` poll. We extend it to also fetch `/api/projects/[id]/cost-history` on mount (and on the same 30s interval when running). The sparkline is conditionally shown only when at least 2 sessions are available (a single point makes a chart meaningless). The chart is rendered below the existing scalar row, inside the same card container — no grid layout changes needed.

### AD-4: Dark/light mode via CSS currentColor

The SVG polyline stroke and axis text are set to `currentColor` with Tailwind classes for both modes (`text-red-500 dark:text-red-400` for the line; `text-gray-400 dark:text-zinc-600` for labels). No JS theme detection is needed.

### AD-5: Responsive SVG with fixed viewBox

The SVG uses `viewBox="0 0 200 48"` with `width="100%"` so it scales to any container width. This matches the card's full-width span (`md:col-span-2`) without media query logic in the component.

### AD-6: Test strategy

- Unit test `SparklineChart` in isolation: empty array, single value, multi-value (verify polyline `points` attribute, axis label count, min/max scaling).
- Unit test the cost-history route handler with mocked `fs` and `sumTranscriptFileCost`: zero files, one file, more-than-10 files (verify slice), sort order.
- Unit test `CostCard` extension: verify sparkline element is absent when `sessions.length < 2`, present when `sessions.length >= 2`.
- All existing 493 unit tests must continue to pass.

---

## Sub-task Decomposition

### T1 — `lib/cost-history.ts`: enumerate and sum per-session costs
- **Size:** S
- **Dependencies:** none (uses existing `encodeProjectPath`, `sumTranscriptFileCost`)
- **Agent type:** Dev (sonnet)
- **Description:** Extract a reusable `getSessionCostHistory(projectPath: string, limit = 10)` function. Reads `~/.claude/projects/{encoded}/*.jsonl`, stats each file, sums cost via `sumTranscriptFileCost`, sorts by `mtimeMs` ascending, slices to `limit`. Returns `Array<{ file: string, cost: number, mtimeMs: number }>`.
- **Test strategy:** Unit test with mocked `fs.readdirSync`, `fs.statSync`, and `sumTranscriptFileCost`. Cases: zero files → empty array; three files returned in mtime order; eleven files → returns last 10 by mtime.
- **Acceptance criteria:**
  - Function exported from `lib/cost-history.ts`
  - Returns empty array when cliDir unreadable (no throw)
  - Entries sorted ascending by mtimeMs (oldest first = left edge of chart)
  - Capped at `limit` most-recent files
  - Unit tests pass
- **Status:** done

### T2 — `GET /api/projects/[id]/cost-history/route.ts`: cost-history endpoint
- **Size:** S
- **Dependencies:** T1
- **Agent type:** Dev (sonnet)
- **Description:** New Next.js App Router route handler. Resolves project by `[id]` index, calls `getSessionCostHistory`, returns `{ data: { sessions: [...] } }`. Wraps in try-catch per BL-025 pattern, returning `{ error }` + 500 on failure. Returns 404 if project not found.
- **Test strategy:** Unit test with mocked `getProjectByIndex` and `getSessionCostHistory`. Cases: project not found → 404; empty sessions → 200 with empty array; happy path → 200 with correct payload; thrown error → 500.
- **Acceptance criteria:**
  - Route file at `app/api/projects/[id]/cost-history/route.ts`
  - Response shape: `{ data: { sessions: Array<{ file: string, cost: number, mtimeMs: number }> } }`
  - Try-catch with structured error response
  - Unit tests pass
- **Status:** done

### T3 — `components/mission-control/sparkline-chart.tsx`: pure SVG sparkline
- **Size:** M
- **Dependencies:** none
- **Agent type:** Dev (sonnet)
- **Description:** Self-contained SVG component. Props: `values: number[]`, `height?: number` (default 48), `className?: string`. Renders: a `<polyline>` scaled to min/max of values with a small bottom padding for labels; one x-axis tick label per value using `mtimeMs` formatted as "Apr 24"; a subtle baseline (`<line>`) at y=bottom; dots at each data point. Stroke color via `currentColor` + Tailwind; background transparent. When `values.length < 2` renders null. Export: `SparklineChart`.

  Props revision: accept `sessions: Array<{ cost: number, mtimeMs: number }>` rather than raw `number[]` so the component can render date labels.

- **Test strategy:** Unit test with `@testing-library/react` + happy-dom. Cases: `sessions.length === 0` → renders null; `sessions.length === 1` → renders null; `sessions.length === 2` → renders `<polyline>` element; verify `points` attribute contains correct normalized coordinates for a known input; date label rendered for each session.
- **Acceptance criteria:**
  - Renders null for fewer than 2 sessions
  - `<polyline>` points are computed from min/max normalization (no hardcoded values)
  - Date labels match `mtimeMs` formatted as "MMM D" (e.g., "Apr 24")
  - SVG has `width="100%"` and `viewBox` attribute
  - `currentColor` used for stroke (not hardcoded hex)
  - All unit tests pass
- **Status:** done

### T4 — Extend `CostCard` to fetch and display sparkline
- **Size:** S
- **Dependencies:** T2, T3
- **Agent type:** Dev (sonnet)
- **Description:** Add a second `fetch` call inside `CostCard` for `/api/projects/${projectId}/cost-history`. Store result in `sessions` state. On the 30s interval and initial mount, fetch both `/cost` and `/cost-history` in parallel via `Promise.all`. Render `<SparklineChart sessions={sessions} />` below the scalars row, wrapped in `{sessions.length >= 2 && ...}`. Add a "Last N sessions" label above the chart (e.g., "Last 7 sessions" if fewer than 10 are available). Keep the existing scalar row and refresh footer unchanged.
- **Test strategy:** Unit test `CostCard` with mocked `fetch`. Cases: history returns 0 sessions → sparkline absent; history returns 1 session → sparkline absent; history returns 3 sessions → sparkline present and "Last 3 sessions" label visible; history fetch failure → sparkline absent (graceful degradation, no error shown to user for the chart).
- **Acceptance criteria:**
  - `SparklineChart` not rendered when fewer than 2 sessions available
  - `SparklineChart` rendered when 2+ sessions available
  - "Last N sessions" label correctly reflects session count (max 10)
  - Cost scalar row (`this session` / `total`) is unchanged
  - 30s poll fetches both endpoints in parallel
  - Graceful degradation: chart failure does not affect scalar display
  - Unit tests pass
- **Status:** in-progress

### T5 — Playwright E2E: cost-history chart renders in DOM
- **Size:** S
- **Dependencies:** T4
- **Agent type:** QA Lead (sonnet)
- **Description:** Add a test to `tests/e2e/cost-card.spec.ts` (or a new file if preferred) that navigates to the mission control page of the haze project, intercepts `GET /api/projects/*/cost-history` to return a mocked payload with 5 sessions of varying costs, and asserts that the SVG sparkline element and "Last 5 sessions" label are visible in the DOM.
- **Test strategy:** Playwright `page.route()` for mock; `page.locator('svg[data-testid="sparkline"]')` for assertion.
- **Acceptance criteria:**
  - SVG sparkline is visible when mocked history returns >= 2 sessions
  - "Last 5 sessions" label is visible
  - Test passes against `http://localhost:3200`
- **Status:** pending

### T6 — Unit tests for all new modules (coverage gate)
- **Size:** S
- **Dependencies:** T1, T2, T3, T4
- **Agent type:** Dev (sonnet)
- **Description:** Consolidate and verify test coverage. Ensure vitest suite passes in full (`npx vitest run`). Fix any type errors surfaced by `tsc --noEmit`. No new implementation; this is a quality gate task.
- **Test strategy:** `npx vitest run` must exit 0; `npm run build` must exit 0.
- **Acceptance criteria:**
  - All existing tests pass (493+)
  - New tests from T1–T5 all pass
  - No TypeScript errors
  - Build clean
- **Status:** pending

---

## Data Flow Diagram

```
mission-control page
  └── CostCard (client, useEffect poll 30s)
        ├── fetch /api/projects/{id}/cost         → { session, total }
        └── fetch /api/projects/{id}/cost-history → { sessions: [{file, cost, mtimeMs}] }
              ↑
              cost-history/route.ts
                └── getSessionCostHistory(projectPath)  [lib/cost-history.ts]
                      ├── encodeProjectPath()            [lib/transcript-file-resolver.ts]
                      └── sumTranscriptFileCost()        [lib/cost-calculator.ts]
```

---

## Key Files

| File | Action |
|------|--------|
| `lib/cost-history.ts` | New — session enumeration helper |
| `app/api/projects/[id]/cost-history/route.ts` | New — REST endpoint |
| `components/mission-control/sparkline-chart.tsx` | New — SVG sparkline |
| `components/mission-control/sparkline-chart.test.tsx` | New — unit tests |
| `components/mission-control/cost-card.tsx` | Modified — add sparkline |
| `components/mission-control/cost-card.test.tsx` | New — unit tests |
| `app/api/projects/[id]/cost-history/route.test.ts` | New — unit tests |
| `lib/cost-history.test.ts` | New — unit tests |
| `tests/e2e/cost-card.spec.ts` | Modified — add sparkline E2E test |

---

## Open Questions

None. All decisions made with sufficient confidence to proceed without CEO input. The "no new dependency" constraint from the backlog is satisfied by AD-1. Dark/light mode is satisfied by AD-4.

---

## Risks

- **Risk 1:** If a project has zero CLI transcript files (fresh install, only in-memory sessions), `getSessionCostHistory` returns an empty array and the sparkline is simply hidden — no degraded state shown to user.
- **Risk 2:** The `sumTranscriptFileCost` call per file is I/O-bound. For 10 files this is acceptable (<200ms on SSD). No streaming or caching is needed for this feature.
