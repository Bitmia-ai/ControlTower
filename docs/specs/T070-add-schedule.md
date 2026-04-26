# T070 — Add Schedule Creation from the Schedules Tab

**Status:** done
**Priority:** P1
**Owner:** CTO

## Problem

The Schedules tab (`/project/[id]/schedules`) is read-only — schedules can
only be added by hand-editing `.redeye/schedules.md`. The CEO wants to
create new recurring tasks directly from the dashboard, the same way
backlog items and steering directives can already be created.

## Goal

A "+ Add Schedule" button in the Schedules page header opens a modal
dialog with fields for name, frequency, optional description, and steps.
On submit, the API appends a new `### SCHED-{id}: {title}` block to
`.redeye/schedules.md` (with `lastRunIso = 1970-01-01T00:00:00Z` so it
shows as "Never run" / overdue), commits + pushes the change, then the
list refetches.

## Approach

### API — POST /api/projects/[id]/schedules

Add a `POST` handler to `app/api/projects/[id]/schedules/route.ts`.

Body: `{ name: string, frequency: string, description?: string, steps: string[] }`

Validation:

- `name` required, non-empty after `sanitizeMarkdownInput({ maxLen: 200 })`.
- `frequency` required, non-empty after `sanitizeMarkdownInput({ maxLen: 100 })`.
  Free-form (e.g. `"every 7d"`, `"daily"`) — the parser already tolerates
  unknown formats by leaving `nextDueMs = null`.
- `steps` required, must be an array with at least one non-empty entry
  after sanitization. Each step is sanitized with
  `sanitizeMarkdownInput({ maxLen: 500 })` and capped at 50 entries.
- `description` optional — currently the schedule format has no
  `Description:` field, so we accept and ignore it (or fold it into the
  title); spec keeps it OPTIONAL for forward-compat.

Body cap: 16 KB (`MAX_BODY_BYTES = 16 * 1024`) via `readJsonBody`.
Content-Type and CSRF inherited from `middleware.ts`.

ID assignment:

- Read the current `schedules.md` content, scan for `SCHED-\d+`, and use
  `max + 1`. Falls back to `1` if no entries exist.
- Format as `SCHED-N` (no zero-padding) to match the existing
  `SCHED-1` style in `.redeye/schedules.md`.
- We deliberately do NOT mutate `state.json.counters.next_sched_id`
  here — that file is owned by the autonomous CTO and must not be
  written by the dashboard. The `max + 1` scan is sufficient and
  collision-free as long as schedules.md is the single source of truth.

Write format (matches existing parser exactly):

```
### SCHED-{id}: {name}
- **Frequency:** {frequency}
- **Last run:** 1970-01-01T00:00:00Z
- **Task:**
  1. {step 1}
  2. {step 2}
- **Assigned to:** CTO
```

Insertion: append to the end of the file, prefixed with a blank line so
adjacent blocks stay separated. If the file does not exist (ENOENT), we
seed a header and the entry.

Best-effort `commitAndPush` for `.redeye/schedules.md` so TRIAGE's
sync-from-main on the next iteration doesn't drop the entry.

Status codes:

- 200 success → `{ data: { success: true, schedule: ScheduleEntry, committed, pushed } }`
- 400 missing/invalid field
- 404 project missing
- 413/415 inherited from `readJsonBody`
- 500 unexpected

### UI

In `app/project/[id]/schedules/page.tsx`:

- Add a "+ Add Schedule" button in the page header, right side, matching
  the backlog page's button (`bg-red-600 hover:bg-red-500 ... min-h-[44px]`).
- Lift the dialog open state to `SchedulesContent`.
- After successful POST, call `fetchSchedules()` to refresh the list.

New component `components/schedules/add-schedule-dialog.tsx`:

- Radix `Dialog.Root` with the same chrome as `add-backlog-dialog.tsx`.
- Fields:
  - **Name** (required text input, autofocus).
  - **Frequency** (required text input, placeholder: `e.g. every 7d, daily, weekly`).
  - **Steps** (required textarea, one step per line, placeholder shows
    multi-line example).
  - **Description** (optional textarea — collapsed under "Add details").
- Submit button disabled until name + frequency + at least one step are
  non-empty.
- Submit: POST `/api/projects/${projectId}/schedules`. On success, reset
  fields, close dialog, call `onAdded()`. On error, render inline red
  message.
- Dark/light mode + red-600 primary button consistent with the rest of
  the design system.

### Tests

API (`route.test.ts` — extend existing file):

- POST 200 happy path writes a SCHED-N block in the expected format.
- POST 200 assigns SCHED-1 when file is missing (ENOENT).
- POST 200 assigns SCHED-(max+1) when file has existing entries.
- POST 400 when name missing / empty after sanitize.
- POST 400 when frequency missing / empty after sanitize.
- POST 400 when steps missing / not an array / empty array / all-empty
  after sanitize.
- POST 404 when project missing.

Component (`components/schedules/add-schedule-dialog.test.tsx`):

- Renders all fields when open.
- Submit button disabled until name + frequency + steps are non-empty.
- Submit calls POST with the right body (steps split by newline,
  trimmed, empty lines filtered).
- Inline error renders when API returns `{ error }`.
- onAdded + onOpenChange(false) called on success.

### Build verification

- `npx vitest run` — all green (currently 731, will grow).
- `npm run build` — clean.

## Sub-tasks

- [done] T1 — Add POST handler to schedules route + tests
- [done] T2 — Add `AddScheduleDialog` component + tests
- [done] T3 — Wire button into Schedules page header + refetch on add
- [done] T4 — Build verification (vitest + next build) — 762/762 tests pass, build clean.

## Out of Scope

- Editing existing schedules (read-only after creation for now).
- Deleting schedules.
- Setting `assigned_to` from the UI (defaults to `CTO`).
- Persisting an explicit `description` field in schedules.md (the parser
  has no notion of one yet — folded out of scope).
- Updating `state.json.counters.next_sched_id` — that counter is
  CTO-owned and not touched here.
