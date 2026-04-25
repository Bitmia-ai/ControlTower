# BL-063: Steer Tab — Add Fully Functional Steering Directive UI

**Status:** planned  
**Priority:** P1  
**Type:** feature  
**Spec authored:** 2026-04-25

---

## Problem Statement

There is no in-dashboard way to send a steering directive to the running CTO. Users must use the `/redeye:steer` CLI skill or edit `.redeye/steering.md` by hand. A Steer tab at `/project/[id]/steer` would surface this as a first-class UI action alongside Backlog, History, Live, and Schedules.

---

## Architecture Decisions

### 1. New page: `app/project/[id]/steer/page.tsx`

A `'use client'` page following the same pattern as `schedules/page.tsx`. It exports a testable `SteerContent` component that receives `id: string`, plus a default export that unwraps `params` with `use()`.

### 2. New API endpoint: `GET /api/projects/[id]/steer/route.ts`

The existing `POST` writes a directive. A `GET` handler needs to be added to the same file to return the current list of parsed directives. It calls `readSteering(project.path)` from `lib/redeye-files.ts` (already exported) and returns `{ data: { directives: SteeringDirective[] } }`.

No new library function is needed — `readSteering` is already implemented and tested.

### 3. Nav addition: `components/project-nav.tsx`

Add `{ label: "Steer", path: "/steer" }` to the `NAV_ITEMS` array. No keyboard shortcut is added (BL-061 removed all shortcut badges; consistent with current state).

### 4. `SteerPage` component layout

Two sections:

- **Submit form** (top): textarea for directive text, submit button, loading/success/error feedback inline below the form. No modal or dialog — inline feedback keeps the flow fast.
- **Current directives** (below form): a read-only list of all entries currently in `steering.md` under `## Directives`, loaded on mount and refreshed after a successful POST. Shows an empty state when no directives exist. Shows a skeleton on initial load.

### 5. Error/success feedback

- On submit: button shows "Sending…" while the request is in-flight (disabled to prevent double-submit).
- On success: green inline message "Directive added." that fades or persists until next edit.
- On error: red inline message showing the server error string.
- Form textarea is cleared on success.

### 6. Optimistic UI decision

NOT optimistic — we re-fetch directives from the server after success to guarantee the list matches what is actually in `steering.md`. This avoids stale state if the file was modified externally.

### 7. Raw steering.md content

Not shown verbatim. The page shows structured parsed directives (text + optional date). This is consistent with how other tabs expose parsed data rather than raw markdown.

---

## Sub-task Decomposition

### T1 — Add GET handler to steer API route (S)
- **File:** `app/api/projects/[id]/steer/route.ts`
- **Work:** Add `export async function GET(...)` that resolves the project, calls `readSteering(project.path)`, and returns `NextResponse.json({ data: { directives } })`. Reuse existing `getProjectByIndex` + try-catch pattern from the same file.
- **Dependencies:** none
- **Assigned agent:** Dev (generic)
- **Test strategy:** Unit test in `app/api/projects/[id]/steer/route.test.ts` — mock `getProjectByIndex` and `readSteering`; verify 200 with directive list, 404 on missing project, 500 on read error.
- **Acceptance criteria:**
  - `GET /api/projects/1/steer` returns `{ data: { directives: [...] } }` when steering.md has entries.
  - Returns `{ data: { directives: [] } }` when file is empty or has no Directives section.
  - Returns 404 when project index is invalid.
  - Returns structured 500 on unexpected errors.
- **Status:** done

### T2 — Add Steer tab to ProjectNav (S)
- **File:** `components/project-nav.tsx`
- **Work:** Append `{ label: "Steer", path: "/steer" }` to `NAV_ITEMS`. No other changes.
- **Dependencies:** none
- **Assigned agent:** Dev (generic)
- **Test strategy:** Update `components/project-nav.test.tsx` (if it exists) or add tests asserting the Steer link renders and gets the active class when pathname is `/project/1/steer`.
- **Acceptance criteria:**
  - "Steer" tab appears to the right of "Schedules" in the nav bar.
  - Tab is highlighted when the user is on `/project/[id]/steer`.
  - Tab is not highlighted on any other route.
- **Status:** done

### T3 — Implement SteerContent component and page (M)
- **File:** `app/project/[id]/steer/page.tsx`
- **Work:**
  - `'use client'` page.
  - `SteerContent({ id })`: state: `directive: string`, `submitting: boolean`, `success: boolean`, `error: string | null`, `directives: SteeringDirective[] | null`, `loadError: string | null`.
  - `fetchDirectives()`: GET `/api/projects/${id}/steer`, set state.
  - `handleSubmit(e)`: prevent default, POST to `/api/projects/${id}/steer` with `{ directive }`, set success/error, clear textarea, call `fetchDirectives()` on success.
  - Render: page heading + subtitle, textarea (min 3 rows, placeholder "Type a directive for the CTO…"), submit button ("Send Directive" / "Sending…" while in-flight), inline success/error feedback, then a section "Current Directives" showing the list or empty state or skeleton.
  - Skeleton: 3 animated pulse rows, shown only when `directives === null` and no load error.
  - Empty state: "No directives yet." in muted text.
  - Directive list: each item as a row with text and optional date badge.
  - Dark/light mode using existing Tailwind dark: variants.
  - Textarea disabled while submitting.
  - Default export unwraps `params` with `use()` and renders `<SteerContent id={id} />`.
- **Dependencies:** T1 (GET endpoint must exist), T2 (nav link)
- **Assigned agent:** Dev (generic)
- **Test strategy:** Unit tests in `app/project/[id]/steer/page.test.tsx`:
  - Renders form with textarea and submit button.
  - Disables button and textarea while submitting (mock fetch in-flight).
  - Shows success message and clears textarea after successful POST.
  - Shows error message on failed POST.
  - Renders skeleton on initial load (before GET resolves).
  - Renders directive list after GET resolves.
  - Renders empty state when directive list is empty.
- **Acceptance criteria:**
  - Page renders at `/project/[id]/steer` with no JavaScript errors.
  - Submitting a non-empty directive POSTs to the API and shows "Directive added." on success.
  - Submitting an empty directive is blocked (submit button disabled when textarea is blank/whitespace-only).
  - Error from API surfaces as a red inline message.
  - Directive list refreshes after each successful submission.
  - Dark and light mode both render correctly.
- **Status:** done

### T4 — Unit tests for steer API GET (S)
- **File:** `app/api/projects/[id]/steer/route.test.ts` (new)
- **Work:** Vitest unit tests covering the GET handler (T1). Keep POST test coverage consistent — add at minimum a smoke test confirming the existing POST still works after the refactor (if any import changes were needed).
- **Dependencies:** T1
- **Assigned agent:** Dev (generic)
- **Test strategy:** Mock `lib/projects` and `lib/redeye-files` with `vi.mock`. Assert response shape and status codes for all branches.
- **Acceptance criteria:**
  - All GET test cases pass.
  - `npx vitest run` green across full suite.
- **Status:** done

### T5 — Production build and full regression (S)
- **Work:** Run `NODE_ENV=production npm run build` and `npx vitest run`. Fix any TypeScript or lint errors introduced by T1–T4.
- **Dependencies:** T1, T2, T3, T4
- **Assigned agent:** Dev (generic) / QA Lead
- **Test strategy:** Build must exit 0; vitest must show 0 failures. Playwright smoke: navigate to Steer tab in browser, submit a directive, confirm it appears in the list.
- **Acceptance criteria:**
  - `npm run build` exits cleanly (no TypeScript errors, no prerender errors).
  - `npx vitest run` — all tests pass.
  - Playwright: Steer tab is visible and functional on `http://localhost:3200/project/1/steer`.
- **Status:** pending

---

## Open Questions

None. The feature scope is clear; no CEO input required before starting BUILD.

---

## Files Touched Summary

| File | Change |
|------|--------|
| `app/api/projects/[id]/steer/route.ts` | Add GET handler |
| `app/api/projects/[id]/steer/route.test.ts` | New — unit tests for GET (and POST smoke) |
| `components/project-nav.tsx` | Add Steer to NAV_ITEMS |
| `app/project/[id]/steer/page.tsx` | New — steer page |
| `app/project/[id]/steer/page.test.tsx` | New — unit tests for SteerContent |

No new dependencies. No schema changes. No changes to `lib/`.
