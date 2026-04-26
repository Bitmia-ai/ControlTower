# T042: Backlog Detail Cost (est.) Always Shows "Not recorded" — Fix It

## Overview

The backlog detail page (`/project/[id]/backlog/[taskId]`) displays a "Cost (est.)" row for items with `status === "done"`, but the value is always "Not recorded". The UI plumbing is correct — it reads `item_costs[taskId]` from `state.json`. The problem is that `item_costs` is never populated during the normal RedEye phase cycle. The `cost-snapshot` API exists but was only called manually once (for T038); it is not wired into the VERIFY phase automatically.

The fix has two parts:
1. **Root cause (new items):** Wire the cost-snapshot call into the Control Tower VERIFY UI so the CTO can capture cost at completion time without a manual API call.
2. **Backfill (historical items):** Provide a way for the CTO to record a cost for already-completed items via the existing POST `/cost-snapshot` endpoint.

---

## Background

### Data flow for cost display

```
state.json → item_costs[BL-xxx]
     ↓
GET /api/projects/[id]/backlog/[taskId]
     reads state via readState(), returns { ...item, cost_usd: cost }
     ↓
page.tsx
     item.cost_usd !== undefined && item.cost_usd > 0 → "$X.XX"
     else → "Not recorded"
```

### What `item_costs` contains today

`state.json` currently has only one entry:

```json
"item_costs": {
  "T038": 44.71138350000003
}
```

This was written manually during T038's VERIFY phase by calling `POST /api/projects/[id]/cost-snapshot`. All other completed items (T001 through T037, T039, T043) have no entry and display "Not recorded".

### Why `cost-snapshot` is not called automatically

The `POST /api/projects/[id]/cost-snapshot` route calls `sumCurrentSessionCost()`, which reads the most-recently-modified `.jsonl` transcript file and sums all assistant token costs. This gives a good approximation of the session cost at VERIFY time. However:

- The endpoint is never called from the UI — no button, no automatic trigger.
- The CTO is expected to call it via the API during VERIFY, but that is a manual step that is easy to forget and was not documented in the VERIFY skill.
- There is no retrospective mechanism for items completed in earlier sessions.

### What the cost number represents

The cost-snapshot captures the **total cost of the current transcript file** at the moment it is called. This is a session-level figure, not a per-item delta. For a typical session where only one backlog item is completed, this approximation is good. For multi-item sessions it over-counts, but it is the best available data without per-item tracing.

This is acceptable per the original T020 design: "Cost (est.)" is explicitly labeled as an estimate.

### Per-item cost sourcing options

| Option | Feasibility | Chosen? |
|---|---|---|
| a) `item_costs` map in state.json written by the CTO via cost-snapshot | Exists, works, needs UI wire-up | YES |
| b) Parse JSONL transcripts for BL IDs | Transcripts don't contain BL IDs; not feasible | No |
| c) Divide total cost proportionally across items | No item-duration data available | No |
| d) Show session cost on the active item | Same as option (a) at snapshot time | Collapsed into (a) |
| e) RedEye plugin writes item_costs at MERGE time | Cross-repo change; complex | Not in this BL |

---

## Architecture Decisions

### AD-1: Wire cost-snapshot into the VERIFY UI flow

Add a "Record cost snapshot" button to the backlog detail page for `done` items that have no recorded cost. Clicking it calls `POST /api/projects/[id]/cost-snapshot` with the current item's BL ID and immediately refreshes the displayed cost. This is the lowest-friction fix with zero new infrastructure.

The button is only shown when `item.cost_usd === undefined` (no cost recorded). Once cost is captured, the button disappears and the `$X.XX` value is shown.

### AD-2: No new API routes

The `POST /api/projects/[id]/cost-snapshot` route already exists and is correct. No schema changes needed.

### AD-3: No automatic background capture

Automatic capture on status-change would require either a webhook from the RedEye plugin (cross-repo) or polling `backlog.md` in the dashboard (fragile). The manual button is simpler and reliable. A follow-up steering directive to the CTO can standardize calling it at VERIFY time.

### AD-4: Historical items — show "Not recorded (pre-T042)" for very old items

Items completed before T020 shipped the cost infrastructure genuinely have no recoverable cost. Items completed after T020 but before T042 (which added the UI button) could have cost captured retroactively by clicking the button on their detail page — but only if the session transcript is still accessible. The button will be shown for all `done` items with no cost entry and will gracefully handle a `cost_usd: 0` return by showing "Not recorded" (already the fallback).

### AD-5: Keep the "Not recorded" fallback

The display logic `item.cost_usd !== undefined && item.cost_usd > 0` stays. If the transcript is gone (session ended, file rotated) and the snapshot returns `$0.00`, the UI will still show "Not recorded". The button allows a retry attempt if the user believes the transcript exists.

---

## Sub-tasks

### T1: Add "Record cost" button to backlog detail page
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/backlog/[taskId]/page.tsx`
- **Logic:**
  - Add local state: `const [snapshotting, setSnapshotting] = useState(false)`
  - Add `handleRecordCost` async function:
    1. Set `snapshotting = true`
    2. `POST /api/projects/{id}/cost-snapshot` with body `{ blId: taskId }`
    3. On success: call `fetchItem()` to re-fetch and refresh `item.cost_usd`
    4. Set `snapshotting = false`
  - In the `Cost (est.)` `<dd>` block, when `item.cost_usd` is undefined or 0:
    - Show the "Not recorded" span as before
    - Below it (inline or on next line), show a small `<button>` labeled "Record now" (or spinner "Recording…" when `snapshotting`)
    - Button style: `text-xs text-blue-600 dark:text-blue-400 hover:underline` (subtle link-style)
  - The button is hidden once `item.cost_usd > 0` is returned from the API
- **Acceptance criteria:**
  - "Record now" button visible for done items with no cost
  - Clicking it POSTs to cost-snapshot and refreshes the cost field
  - Button disappears and `$X.XX` shown after successful snapshot
  - "Not recorded" still shown if snapshot returns 0 (no active transcript)
  - Button is absent for non-done items (cost row itself is hidden for non-done)
- **Status:** done

### T2: Unit tests for the updated detail page
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/backlog/[taskId]/route.test.ts`
- **Note:** The route itself is unchanged. Tests should cover the *new UI behavior* — but since the page is a client component, these are React Testing Library tests.
- **File:** (new) `app/project/[id]/backlog/[taskId]/page.test.tsx`
- **Logic:**
  - Mock `fetch` for the GET `/api/projects/{id}/backlog/{taskId}` and POST `/api/projects/{id}/cost-snapshot` calls
  - Test 1: done item with no cost → renders "Not recorded" + "Record now" button
  - Test 2: done item with cost_usd = 1.42 → renders "$1.42", no "Record now" button
  - Test 3: click "Record now" → fetch POST is called with correct body; after mock response, cost field updates
  - Test 4: non-done item → no cost row rendered at all
- **Acceptance criteria:**
  - All 4 test cases pass
  - Full vitest suite green (`npx vitest run`)
- **Status:** done

### T3: Update the cost-snapshot API to handle the case where no transcript exists more gracefully
- **Size:** S
- **Dependencies:** none (parallel with T1)
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/cost-snapshot/route.ts`
- **Current behavior:** Returns `{ data: { blId, cost_usd: 0 } }` when no transcript is readable — this is written to `item_costs` as 0. Next time the detail page is loaded, `cost_usd > 0` is false so it still shows "Not recorded", but the 0 entry is now in state.json and the button would still show.
- **Fix:** Do not write to `item_costs` when `cost_usd === 0`. Return a 200 with a `{ data: { blId, cost_usd: 0, recorded: false } }` signal so the caller knows no snapshot was taken.
- **Alternative (simpler):** Return 200 with cost_usd even if 0; the UI button re-appears on next load because `cost_usd > 0` is still false. No state.json pollution. This is the chosen approach — no state.json write when cost_usd is 0.
- **Acceptance criteria:**
  - When `sumCurrentSessionCost` returns 0, the route returns 200 but does NOT write to state.json
  - When cost > 0, behavior unchanged — writes to state.json and returns cost
  - Existing tests remain green; add 1 new test for the zero-cost no-write case
- **Status:** done

### T4: E2E verification with Playwright
- **Size:** S
- **Dependencies:** T1, T2, T3
- **Agent:** Dev (generic)
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Navigate to a done backlog item's detail page (e.g. T039)
  2. Verify "Not recorded" + "Record now" button are visible
  3. Click "Record now"
  4. Verify cost field updates (either shows `$X.XX` or remains "Not recorded" if transcript not available — either is acceptable)
  5. Navigate to T038 detail page → verify `$44.71` is shown and no "Record now" button present
  6. Screenshot for record
- **Note:** This is Playwright MCP verification at VERIFY time, not an automated test file.
- **Acceptance criteria:** Steps 1–6 pass visually
- **Status:** pending

---

## Files Touched

| File | Change |
|---|---|
| `app/project/[id]/backlog/[taskId]/page.tsx` | Add "Record now" button and `handleRecordCost` handler |
| `app/api/projects/[id]/cost-snapshot/route.ts` | Skip state.json write when cost_usd is 0 |
| `app/api/projects/[id]/cost-snapshot/route.test.ts` | Add test: zero cost → no write |
| `app/project/[id]/backlog/[taskId]/page.test.tsx` | New: 4 test cases for cost row + button behavior |

## No Changes Required

- `app/api/projects/[id]/backlog/[taskId]/route.ts` — already reads `item_costs` and returns `cost_usd`; correct as-is
- `lib/redeye-files.ts` / `lib/redeye-parsers.ts` — no new parsing needed
- `lib/redeye-types.ts` — `cost_usd?: number` on `BacklogItem` already exists
- `lib/cost-calculator.ts` — `sumCurrentSessionCost()` is correct
- `lib/transcript-file-resolver.ts` — no changes

---

## Test Strategy

- **Unit (vitest):** T2 adds a new test file (`page.test.tsx`) with 4 cases. T3 adds 1 case to the existing `cost-snapshot/route.test.ts`. Full suite must remain green.
- **E2E (Playwright MCP):** T4 verifies button appearance and cost capture interactively at VERIFY time.
- **No integration test changes** — the route-level tests in `backlog/[taskId]/route.test.ts` (13 tests, T022) are unaffected.
