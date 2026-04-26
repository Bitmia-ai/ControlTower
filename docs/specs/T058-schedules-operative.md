# T058: Schedules UI Needs to Be Operative

## Background

T055 shipped a read-only Schedules tab that displays scheduled tasks from
`.redeye/schedules.md`. The CEO's feedback (T058) is that the UI needs to be
"operative" — i.e. users should be able to interact with schedules, not just
view them.

## Context: Existing Implementation

- **Read UI:** `app/project/[id]/schedules/page.tsx` + `components/schedules/schedule-list.tsx`
- **API (read):** `app/api/projects/[id]/schedules/route.ts` — parses and returns schedule entries
- **Data:** `.redeye/schedules.md` — currently empty (no schedules defined)
- **Parser:** `lib/redeye-parsers.ts` — `parseSchedules()` returns `ScheduleEntry[]`
- **Types:** `lib/redeye-types.ts` — `ScheduleEntry` type

## What "Operative" Means

The SCHEDULES phase of the CTO loop (defined in config.md) fires when
`overdue_schedules > 0`. "Operative" means:

1. **Trigger a schedule run from the dashboard** — a "Run now" button on
   overdue (or any) schedule row that kicks off the CTO SCHEDULES phase.
2. **Create a sample schedule** in `.redeye/schedules.md` so the UI is
   demonstrably useful (not empty).
3. **Fix the build** — `/_global-error` prerender fails in Next.js 16 with
   Turbopack; `global-error.tsx` needs to be self-contained.

## Sub-tasks

### T1: Fix global-error.tsx build failure

The `app/global-error.tsx` prerender fails because Next.js 16 tries to render
it without the root layout (no ThemeProvider/ToastProvider). Fix: add `"use client"` 
directive (already there) and suppress the useContext call by wrapping the 
global error in a minimal self-contained HTML shell with no provider dependencies.

Root cause: The build includes the ThemeProvider context consumer in the `/_global-error`
prerender bundle. The fix is to ensure `global-error.tsx` doesn't import or use
any context-dependent components.

Current file is already minimal — the issue may be that Next.js 16 Turbopack
pre-renders the global error page with the whole app bundle. Try adding:
```tsx
export const dynamic = 'force-dynamic';
```
to `global-error.tsx` to skip static prerender.

### T2: Add POST /api/projects/[id]/schedules/run endpoint

```
POST /api/projects/[id]/schedules/run
Body: { scheduleId: "SCHED-1" }
Response: { data: { queued: true, scheduleId: "SCHED-1" } }
```

Behavior: writes a steering directive to `.redeye/steering.md` to trigger the 
SCHEDULES phase for the specified schedule. The CTO picks this up at the next 
phase boundary.

Alternatively (simpler): start the CTO session via `startSession()` if stopped,
and append an overdue-schedule entry so the loop picks it up.

Even simpler: just write to `.redeye/steering.md`:
```
RUN_SCHEDULE: SCHED-{id}
```
And if the CTO is stopped, call `startSession()`.

### T3: Add "Run now" button to ScheduleRow

In `components/schedules/schedule-list.tsx`, add a "Run now" button to each 
`ScheduleRow`:

```tsx
<button
  onClick={() => handleRun(entry.id)}
  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
>
  Run now
</button>
```

The button POSTs to `/api/projects/{id}/schedules/run` with `{ scheduleId: entry.id }`.
Show a loading state and success/error feedback.

### T4: Add a sample schedule to .redeye/schedules.md

Add a real, useful schedule:

```markdown
### SCHED-1: Weekly dependency audit
- **Frequency:** every 7 days
- **Last run:** (never)
- **Task:**
  1. Run `npm audit` and report vulnerabilities to `.redeye/tester-reports.md`
  2. Check for outdated packages with `npm outdated`
  3. File backlog items for any high/critical vulnerabilities found
- **Assigned to:** CTO
```

### T5: Add run endpoint to SchedulesContent page

Pass `projectId` as a prop to `SchedulesContent` (it currently receives only `id` 
as a string). Thread `projectId` (number) down to `ScheduleList` → `ScheduleRow` 
so the "Run now" button can call the correct endpoint.

### T6: Unit tests

- Test `POST /api/projects/[id]/schedules/run` (mock fs, mock session-manager)
- Test `ScheduleRow` renders "Run now" button and calls fetch on click
- Test that sample schedule in schedules.md is parsed correctly

## Acceptance Criteria

- [ ] `npm run build` passes (no prerender errors)
- [ ] `npx vitest run` passes (all tests green)
- [ ] Schedules tab shows at least one schedule (SCHED-1)
- [ ] "Run now" button visible on each schedule row
- [ ] Clicking "Run now" POSTs to the run endpoint and shows success feedback
- [ ] The run endpoint writes a steering directive and auto-starts the CTO if stopped
- [ ] T059 and T060 marked as done in backlog.md
