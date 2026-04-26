# BL-046: Per-task Cost Auto-recorded as End-minus-Start Delta

## Overview

Currently BL-042 added a "Record now" manual button on the backlog item detail page to capture cost for completed tasks. The CEO wants cost recorded **automatically** when a task completes — no manual action required. The recorded cost must be a delta (cost at task end minus cost at task start) so it reflects only the work done on that item, not the entire session total.

## Background

### Current cost-snapshot mechanism

`POST /api/projects/[id]/cost-snapshot` (route: `app/api/projects/[id]/cost-snapshot/route.ts`) accepts a `blId` and:
1. Calls `sumCurrentSessionCost(project.path)` — reads the current Claude transcript JSONL and sums all assistant token costs.
2. Writes the raw session total to `state.json` under `item_costs[blId]`.

This works for a manual "snapshot now" action but is wrong for per-task costs because it captures the cumulative session total, not the cost attributable to the specific task. After several tasks in a session, the session total for item N includes the cost of items 1 through N-1.

### What delta means

```
cost_for_task = cost_at_task_end − cost_at_task_start
```

- `cost_at_task_start` = session total at the moment `state.backlog_item` first became that task's ID
- `cost_at_task_end` = session total at the moment `state.backlog_item` changes away from that ID (to a new task ID or to null)

### Where polling happens

The mission control page (`app/project/[id]/page.tsx`) polls `GET /api/projects/[id]` every **5 seconds** using `setInterval(fetchDetail, 5_000)`. The response includes `state.backlog_item` (the active BL ID) via `ProjectDetail.state`. This is the natural place to detect task transitions.

The home page has no polling today (BL-023 is still planned). It is **out of scope** for this feature — the mission control page is where the detection happens.

### Why option (d) — polling-based transition detection — is correct

- Option (a)/(d) are equivalent; option (d) is the precise framing: detect `state.backlog_item` change on each poll cycle.
- No cross-repo changes needed (option b is ruled out).
- The CTO does not call Control Tower APIs (option c is ruled out).
- The dashboard already polls at 5s; piggybacking on that poll is zero additional network cost.

## Architecture Decisions

### AD-1: Detect task transition in the mission control page polling hook

Inside `app/project/[id]/page.tsx`, maintain a `useRef` that holds the **previous** value of `detail.state?.backlog_item`. On every successful `fetchDetail()` call, compare the new value to the previous:

```
prevActiveId → newActiveId
```

If `prevActiveId` is a non-null string and `prevActiveId !== newActiveId`, the task `prevActiveId` just completed (or was replaced). At that point, trigger the cost-snapshot POST for `prevActiveId` using the delta mechanism (AD-2).

### AD-2: Store `cost_at_start` in a new `item_cost_starts` map in state.json

When the dashboard detects a task becoming active for the first time (i.e. `prevActiveId` was null or different, `newActiveId` is non-null), it POSTs to a new endpoint `POST /api/projects/[id]/cost-start` with `{ blId: newActiveId }`. This endpoint:
1. Calls `sumCurrentSessionCost()` to get the current session total.
2. Writes it to `state.json` under a new key `item_cost_starts[blId]`.

When the task completes (transition away), the dashboard POSTs to the existing `cost-snapshot` endpoint — but the endpoint is updated to read `item_cost_starts[blId]`, compute the delta `(current_session_cost − start_cost)`, and store that in `item_costs[blId]`.

This keeps all delta math server-side; the client only fires two POSTs (one at start, one at end).

### AD-3: New `item_cost_starts` field in `RedEyeState`

Add `item_cost_starts?: Record<string, number>` to `RedEyeState` in `lib/redeye-types.ts`. This is a sibling to `item_costs`. Both are append-only maps keyed by BL ID.

### AD-4: Modify `cost-snapshot` to use delta when `item_cost_starts[blId]` exists

The updated `cost-snapshot` POST handler:
1. Reads `item_cost_starts[blId]` from state.json.
2. Reads current session cost via `sumCurrentSessionCost()`.
3. If start cost exists: `delta = Math.max(0, current − start)`. Store `delta` in `item_costs[blId]`.
4. If no start cost: fall back to current behavior (store raw total). This preserves backward compatibility with the manual "Record now" button on old items.
5. After writing `item_costs[blId]`, optionally clear `item_cost_starts[blId]` to avoid stale data (or leave it as a debugging trail — see T4 for the decision).

### AD-5: Guard for cost going down

Token costs from the transcript are monotonically increasing (lines are never removed from JSONL). However, if the transcript file rotates between task start and task end, `sumCurrentSessionCost()` may return a lower value than the start snapshot. The endpoint must clamp: `Math.max(0, current − start)`. If the result is 0 or negative (file rotation), the `recorded: false` path fires and no spurious $0 is written.

### AD-6: Guard for session restarts between polls

If the session is restarted between the "start" POST and the "end" POST, the transcript file is a new file. `sumCurrentSessionCost()` will return a small value (cost of this new session only), which when subtracted from the start cost (from the old session) yields a large negative number. The `Math.max(0, ...)` clamp in AD-5 handles this correctly — it records 0 and sets `recorded: false`, preserving the old manual "Record now" fallback.

### AD-7: Same-task multiple-start guard

If the dashboard navigates away and comes back, the `prevActiveId` ref is reset. A new "start" POST would fire again for the same BL ID if the task is still active. To prevent overwriting a valid start snapshot with a later (higher) value, the `cost-start` endpoint should **skip the write if `item_cost_starts[blId]` already exists**. The first snapshot is always the correct baseline.

### AD-8: Scope of the "Record now" button

The existing "Record now" button in `app/project/[id]/backlog/[taskId]/page.tsx` (BL-042) POSTs to `cost-snapshot` directly. After this change, `cost-snapshot` still works without a start record (AD-4 fallback). The "Record now" button can remain as-is for older items without a start record. No changes to the backlog detail page are required.

### AD-9: No home-page changes

BL-023 (home-page polling) is not yet shipped. Adding delta logic to a page that doesn't poll would be premature. Mission control is the only place where real-time task-transition detection makes sense today.

## Sub-tasks

### T1: Add `item_cost_starts` to `RedEyeState` type
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **File:** `lib/redeye-types.ts`
- **Change:** Add `/** Session cost at task start, keyed by BL-xxx. Used for delta calculation. */ item_cost_starts?: Record<string, number>;` to `RedEyeState`.
- **Test strategy:** Type-only change; no runtime test needed. Existing tests continue to compile.
- **Acceptance criteria:** TypeScript compiles with the new field. `vitest run` still green.
- **Status:** done

### T2: New API endpoint `POST /api/projects/[id]/cost-start`
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/cost-start/route.ts` (new file)
- **Logic:**
  1. Parse `{ blId }` from request body. Return 400 if missing.
  2. Look up project by index. Return 404 if not found.
  3. Read `state.json`. Return 500 on failure.
  4. If `state.item_cost_starts?.[blId]` already exists, return early with `{ data: { blId, skipped: true } }` (AD-7 guard — don't overwrite existing start).
  5. Call `sumCurrentSessionCost(project.path)`.
  6. If cost is 0 (no transcript yet), write 0 as the start baseline (a new session has $0 cost so far — delta will be the full session cost at end).
  7. Write `state.item_cost_starts[blId] = cost` atomically (tmp file + rename pattern matching existing `cost-snapshot` route).
  8. Return `{ data: { blId, cost_at_start: cost, recorded: true } }`.
- **Test strategy:** Unit test in `app/api/projects/[id]/cost-start/route.test.ts`. Cases:
  - Missing `blId` → 400
  - Project not found → 404
  - Valid request, no prior start → writes to state.json, returns 200
  - Valid request, prior start exists → skips write (idempotent), returns 200 with `skipped: true`
- **Acceptance criteria:** All 4 test cases pass. Atomic write follows same tmp-rename pattern as `cost-snapshot`.
- **Status:** done

### T3: Update `POST /api/projects/[id]/cost-snapshot` to compute delta
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **File:** `app/api/projects/[id]/cost-snapshot/route.ts`
- **Change:**
  1. After reading `state.json`, check `state.item_cost_starts?.[blId]`.
  2. Get `current_cost = await sumCurrentSessionCost(project.path)`.
  3. If `startCost` exists: `cost_usd = Math.max(0, current_cost − startCost)`.
  4. If `startCost` is absent: `cost_usd = current_cost` (existing behavior — backward compat for "Record now" button).
  5. The `recorded: false` guard remains: if `cost_usd <= 0` with no start cost, skip writing. However, when a start cost exists, a delta of 0 is still valid (e.g. session restarted, transcript rotated — record 0 rather than nothing, since the task did start).
  6. Update `item_costs[blId]` as before.
  7. Optionally clear `item_cost_starts[blId]` after write to keep state.json tidy. Decision: **clear it** — the start snapshot is no longer needed once the delta is stored.
- **Test strategy:** Update `app/api/projects/[id]/cost-snapshot/route.test.ts` (if it exists) or add cases:
  - No start record → stores raw current cost (backward compat)
  - Start record exists, current > start → stores delta = current − start
  - Start record exists, current < start (transcript rotation) → stores 0, `recorded: false`
  - Start record is cleared from `item_cost_starts` after successful write
- **Acceptance criteria:** All new test cases pass. Existing tests still pass. "Record now" button behavior unchanged.
- **Status:** done

### T4: Task-transition detection in mission control page
- **Size:** M
- **Dependencies:** T2, T3
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/page.tsx`
- **Logic:**

  ```
  const prevActiveIdRef = useRef<string | null | undefined>(undefined);

  // Inside fetchDetail (after setDetail):
  const newActiveId = json.data?.state?.backlog_item ?? null;
  const prevActiveId = prevActiveIdRef.current;

  if (prevActiveId !== undefined) {
    // Task became active
    if (prevActiveId !== newActiveId && newActiveId !== null) {
      // POST cost-start for newActiveId (fire-and-forget, no await blocking render)
      fetch(`/api/projects/${id}/cost-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blId: newActiveId }),
      }).catch(console.error);
    }
    // Task just completed
    if (prevActiveId !== null && prevActiveId !== newActiveId) {
      // POST cost-snapshot for prevActiveId (delta)
      fetch(`/api/projects/${id}/cost-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blId: prevActiveId }),
      }).catch(console.error);
    }
  }

  prevActiveIdRef.current = newActiveId;
  ```

  Key points:
  - `undefined` initial value distinguishes "first load" from "task is null" to avoid a spurious start POST on page load.
  - Both POSTs are fire-and-forget (do not block the UI update). Errors are logged.
  - A task change from X to Y fires both: snapshot for X (end) and start for Y (start).
  - A task change from null to Y fires only: start for Y.
  - A task change from X to null fires only: snapshot for X.
- **Test strategy:**
  - Unit test in `app/project/[id]/page.test.tsx` (new file, or extend if it exists). Use `vi.fn()` to mock `fetch`. Simulate poll responses with changing `backlog_item` values and assert the correct POSTs fire.
  - Cases:
    1. Initial load with `backlog_item: "BL-005"` → cost-start POST fires for BL-005; no snapshot.
    2. Second poll same `backlog_item: "BL-005"` → no new POST.
    3. Third poll with `backlog_item: "BL-006"` → snapshot POST for BL-005; start POST for BL-006.
    4. Fourth poll with `backlog_item: null` → snapshot POST for BL-006; no start.
    5. First load with `backlog_item: null` → no POST at all.
- **Acceptance criteria:**
  - Cost-start fires exactly once per new active task (idempotent by T2's guard).
  - Cost-snapshot fires exactly once when a task's ID leaves `state.backlog_item`.
  - No POST fires on the very first poll cycle if the active item was already running before the page loaded (the `undefined` sentinel handles this — wait, see edge case note below).
  - Note: on **first page load** when a task is already active, we DO want to fire cost-start (to record the baseline). The `undefined` guard prevents treating "first load" as a "null → X transition" that skips start. The code above correctly fires start on first load when `newActiveId !== null`.
- **Status:** done

### T5: Unit tests for T4 transition logic (extracted hook)
- **Size:** S
- **Dependencies:** T4
- **Agent:** Dev (generic)
- **Files:** `app/project/[id]/page.test.tsx` (new)
- **Note:** If the transition detection logic is sufficiently complex, extract it to a `useTaskTransitionTracker(activeId, onStart, onEnd)` custom hook in `lib/use-task-transition-tracker.ts` so it can be unit-tested in isolation without rendering the full page. This is at the developer's discretion — if kept inline, test via the page component test.
- **Test strategy:** vitest + React Testing Library or plain hook tests via `renderHook`.
- **Acceptance criteria:**
  - All cases from T4 test strategy pass.
  - `npx vitest run` green (full suite).
- **Status:** done

### T6: E2E verification with Playwright
- **Size:** S
- **Dependencies:** T4, T5
- **Agent:** Dev (generic) / QA Lead
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Navigate to haze mission control page with a session running and a task active.
  2. Inspect `state.json` — verify `item_cost_starts[BL-XXX]` has been written.
  3. Wait for or simulate a task transition (next task or task going to null).
  4. Inspect `state.json` — verify `item_costs[BL-XXX]` has a non-zero delta value and `item_cost_starts[BL-XXX]` is cleared.
  5. Navigate to backlog detail for BL-XXX — verify `Cost (est.)` shows the delta amount.
  6. Screenshot for record.
- **Acceptance criteria:** Steps 2, 4, 5 all pass. Delta is reasonable (not the full session total).
- **Status:** pending

## Files Touched

| File | Change |
|------|--------|
| `lib/redeye-types.ts` | Add `item_cost_starts?: Record<string, number>` to `RedEyeState` |
| `app/api/projects/[id]/cost-start/route.ts` | New endpoint: record session cost at task start |
| `app/api/projects/[id]/cost-start/route.test.ts` | New unit tests for cost-start endpoint (4 cases) |
| `app/api/projects/[id]/cost-snapshot/route.ts` | Update to compute delta when `item_cost_starts[blId]` exists |
| `app/api/projects/[id]/cost-snapshot/route.test.ts` | New/updated test cases for delta logic (4 cases) |
| `app/project/[id]/page.tsx` | Add `prevActiveIdRef` and transition detection logic in `fetchDetail` |
| `app/project/[id]/page.test.tsx` | New unit tests for transition detection (5 cases) |
| `lib/use-task-transition-tracker.ts` | Optional: extracted hook if developer chooses to isolate logic |

## No Changes Required

| File | Reason |
|------|--------|
| `lib/cost-calculator.ts` | `sumCurrentSessionCost()` already does what we need |
| `lib/redeye-files.ts` | No new file parsing needed |
| `lib/redeye-parsers.ts` | No new parsing needed |
| `components/mission-control/cost-card.tsx` | Per-session cost display unchanged |
| `app/project/[id]/backlog/[taskId]/page.tsx` | "Record now" button continues to work as fallback |
| `app/api/projects/route.ts` | Home page list API unchanged |
| `lib/session-manager.ts` | No session lifecycle changes |

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Transcript rotation between start and end | `Math.max(0, delta)` → 0, `recorded: false`, no write to `item_costs` |
| Session restart between start and end | Same as above — new transcript file gives small cost, delta goes negative, clamped to 0 |
| Page navigated away and back while same task is active | `cost-start` is idempotent (T2 AD-7 guard: skips write if start already recorded) |
| First page load, task already active | Fires cost-start with current session total as baseline (OK — partial session cost will be captured) |
| Task ID appears, disappears, reappears (same ID) | Second "start" POST is skipped by idempotency guard. Delta at end will be end − first-start, slightly over-counting. Acceptable trade-off without cross-repo changes. |
| `sumCurrentSessionCost` returns 0 (no transcript) | Start recorded as 0; delta at end = end_cost − 0 = full session cost so far. Acceptable for a new session. |
| Multiple tasks in one poll skip (e.g. poll missed a transition) | Only one transition is detected per poll. Missed intermediate tasks get no cost recorded. This is acceptable — the CTO typically holds one task for many minutes, far exceeding the 5s poll interval. |

## Test Strategy Summary

- **Unit tests (vitest):** T2 (4 cases, new file), T3 (4 cases, existing or new file), T5 (5 cases, new page test). Total: ~13 new test cases.
- **E2E:** Playwright MCP at VERIFY time (T6). Not automated; run interactively.
- **Full suite:** `npx vitest run` must remain green before DEPLOY.

## Questions Posted

None. The approach (polling-based delta detection entirely in the dashboard) is unambiguous and requires no cross-repo changes.
