# T090 + T078: Health Card Count Fix + History UUID Fix

## Summary

Two small P1 UI fixes bundled together:

1. **T090**: Health card "X shipped" shows only session-capped count (recentlyShipped.length, max 10). Should show total done count.
2. **T078**: History tab collapsibles show raw UUID filename in expanded details. Should show human-readable session label.

## T090: Health Card Shipped Count Fix

### Root Cause

In `app/project/[id]/mission-control-client.tsx` line 213:
```tsx
recentlyShippedCount={detail?.recentlyShipped?.length ?? 0}
```
`recentlyShipped` is capped at 10 items (for the Recently Shipped card). So the Health card always shows at most 10 shipped, even if 80+ tasks are done.

`allDoneItems` already exists in `ProjectDetail` (added by T086) and contains the full list of done tasks.

### Fix

**Sub-task T90-1 (S):** In `mission-control-client.tsx`, change the `recentlyShippedCount` prop to use `allDoneItems`:

```tsx
recentlyShippedCount={detail?.allDoneItems?.length ?? 0}
```

**Sub-task T90-2 (S):** Update `HealthCard` to rename the prop for clarity and optionally show session count. The CEO asked for "total done count + session shipped count". Proposal: show total done items as the main number, remove the prop rename (keep as `recentlyShippedCount` for backward compat or rename to `totalShippedCount`).

Decision: rename prop to `totalShippedCount` for semantic accuracy. Update:
- `HealthCard` interface: `recentlyShippedCount` -> `totalShippedCount`  
- `mission-control-client.tsx`: pass `detail?.allDoneItems?.length ?? 0`
- Update tests in `health-card.test.tsx` (if exists) or create tests

**Sub-task T90-3 (S):** Add/update tests for HealthCard with the new prop name.

### Files Changed
- `components/mission-control/health-card.tsx` — prop rename
- `app/project/[id]/mission-control-client.tsx` — pass allDoneItems.length
- `components/mission-control/health-card.test.tsx` (create or update)

---

## T078: History Tab UUID Fix

### Root Cause

In `components/history/session-history-row.tsx` lines 109-113, the expanded details panel shows:
```tsx
<p className="text-xs text-gray-500 dark:text-zinc-500 font-mono truncate">{entry.file}</p>
```
`entry.file` is a raw UUID filename like `abc123-def456-....jsonl` — meaningless to users.

### Fix

The `SessionHistoryEntry` already has:
- `startedAt` — timestamp in ms
- `durationMs` — session duration  
- `phases` — list of phases run
- `cost` — session cost

The expanded details should show useful information instead of (or in addition to) the filename:
- File path is useful for debugging, so keep it but format it better
- Add a "Session label" derived from date + sequential session number
- Show the full phases list when there are more than MAX_VISIBLE_CHIPS

**Sub-task T78-1 (S):** Replace/augment the UUID filename display in `SessionHistoryRow` expanded section:

```tsx
{/* Expanded details */}
{expanded && (
  <div className="px-10 py-3 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
    {/* Show all phases when there are overflow */}
    {entry.phases.length > MAX_VISIBLE_CHIPS && (
      <div className="flex flex-wrap gap-1 mb-2">
        {entry.phases.map((phase, i) => (
          <PhaseChip key={`${phase}-${i}`} phase={phase} />
        ))}
      </div>
    )}
    {/* Show cost and duration */}
    <p className="text-xs text-gray-500 dark:text-zinc-500">
      Duration: {formatDuration(entry.durationMs)} · Cost: {formatCost(entry.cost)}
    </p>
    {/* Keep filename for debugging but de-emphasize */}
    <p className="text-[10px] text-gray-400 dark:text-zinc-600 font-mono truncate mt-1" title={entry.file}>
      {entry.file}
    </p>
  </div>
)}
```

Key changes:
- Show all phases (full list) when overflow > 0 in the expanded section
- Add duration + cost summary line (duration is already shown in header, but cost is also shown — these are already in the summary row, so expanded details should add something new)
- Keep UUID filename but de-emphasize it (smaller text, secondary color)

Actually, re-reading the CEO request: "History tab collapsibles only show some uuid which is useless." The primary problem is the UUID being the only thing shown. The fix should make the expanded section useful.

**Revised approach for T78-1:** In the expanded section:
1. If `phases.length > MAX_VISIBLE_CHIPS`: show the full phase list
2. Show end time (derived from `startedAt + durationMs`)
3. De-emphasize the UUID to a small secondary label with "File:" prefix

**Sub-task T78-2 (S):** Update/add tests in `session-history-row.test.tsx`:
- Test expanded section shows all phases when overflow
- Test end time is shown
- Test UUID is still present but de-emphasized

### Files Changed
- `components/history/session-history-row.tsx` — improve expanded details
- `components/history/session-history-row.test.tsx` — update/add tests

---

## Sub-task Summary

| # | Task | Size | File |
|---|------|------|------|
| T90-1 | Pass allDoneItems.length to HealthCard | S | mission-control-client.tsx |
| T90-2 | Rename prop to totalShippedCount, update display | S | health-card.tsx |
| T90-3 | Add/update HealthCard tests | S | health-card.test.tsx |
| T78-1 | Improve expanded details in SessionHistoryRow | S | session-history-row.tsx |
| T78-2 | Update SessionHistoryRow tests | S | session-history-row.test.tsx |

Total: 5 sub-tasks (all S). No CEO questions needed.

## Test Strategy

- Unit tests for HealthCard prop rename (verify renders correct count)
- Unit tests for SessionHistoryRow expanded details (verify all phases shown when overflow, end time shown, UUID de-emphasized)
- Build must pass clean
- vitest run: 851 baseline tests, must maintain 382 passing, no new regressions

## Acceptance Criteria

1. Health card shows total done count (e.g. "82 shipped" not "10 shipped")
2. History tab expanded rows show useful info: full phase list + end time, UUID de-emphasized
3. All existing tests continue to pass
4. Build clean
