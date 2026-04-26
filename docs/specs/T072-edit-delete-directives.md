# BL-072 — Edit and Delete Steer Directives

**Status:** done
**Priority:** P1
**Owner:** CTO

## Problem

The Steer tab currently shows directives as read-only rows (with markdown rendering from BL-073). The CEO wants to edit or delete individual directives directly from the dashboard so stale or incorrect directives don't accumulate in `.redeye/steering.md`.

## Goal

Each directive row gets hover-revealed Edit and Delete actions:

- **Delete** removes the directive line from `## Directives` in `steering.md` (with inline confirm).
- **Edit** swaps the row for an inline textarea (pre-populated with the directive's current source) and saves a replacement line.

Identification is by **stable directive index** within the parsed list (the same index the UI already uses to render rows), to keep the API contract simple and robust to client drift.

## Approach

### Parser (no change)

`parseSteering` already walks every line in the `## Directives` section, picks `- ` bullets, and skips placeholder `_(none)` rows. The resulting array index is what the UI already keys on. We reuse that same logical index in the API.

### Lib: directive line mutation

Add to `lib/redeye-files.ts` (or alongside `parseSteering` in `lib/redeye-parsers.ts` if write helpers grow there) a small helper used by the API:

- `applyDirectiveEdit(content: string, index: number, newText: string): string` — locates the Nth `- ` directive line under `## Directives` (skipping placeholder `_(` lines, mirroring the parser's filter), and replaces it with `- {newText}` while preserving the rest of the file byte-for-byte.
- `applyDirectiveDelete(content: string, index: number): string` — removes the Nth such line entirely (including its trailing newline).

Both throw a `RangeError("directive index out of range")` if the index doesn't resolve. The route handler maps that to a 404.

This keeps file structure (subsection `###` headers, blank-line spacing) intact even when only one bullet inside a subsection is mutated.

### API

In `app/api/projects/[id]/steer/route.ts`:

- `PATCH` — body `{ index: number, text: string }`. Validates `index` is a non-negative integer, sanitizes `text` with `sanitizeMarkdownInput(text, { maxLen: 500 })` (same rules as POST), reads `steering.md`, applies `applyDirectiveEdit`, writes via `safeRedeyePath`, then `commitAndPush` best-effort.
- `DELETE` — body `{ index: number }`. Validates index, reads, applies `applyDirectiveDelete`, writes, commits.

Status codes:
- 200 success → `{ data: { success: true, committed, pushed } }`
- 400 missing/invalid field
- 404 project missing OR index out of range
- 413/415 inherited from `readJsonBody`
- 500 unexpected

CSRF is inherited from `middleware.ts` (matcher covers `/api/:path*`).

### UI

Refactor `DirectiveRow` in `app/project/[id]/steer/page.tsx`:

- Lift state to `SteerContent` so it can re-fetch after a mutation.
- Pass `index`, `onDeleted`, `onEdited` props down.
- Hover-reveal pencil + trash icon buttons in the top-right of the row (alongside the date badge), `opacity-0 group-hover:opacity-100 transition`. Both have `aria-label`.
- **Edit flow:**
  - Pencil → row swaps for a textarea pre-filled with `directive.text` (the raw source, including any trailing date), plus Save / Cancel buttons.
  - Save calls `PATCH /api/projects/[id]/steer` with `{ index, text }`. On success, refetch directives. On error, show inline red error.
- **Delete flow:**
  - Trash → inline red-tinted confirmation panel inside the row ("Delete this directive?" + Confirm / Cancel) — same pattern as `components/project-card.tsx`.
  - Confirm calls `DELETE /api/projects/[id]/steer` with `{ index }`. On success, refetch. On error, show inline red error.
- During mutation: disable buttons + show ellipsis label.

### Tests

API (`route.test.ts`):

- `PATCH` 200 happy path replaces the targeted line and writes the file.
- `PATCH` 400 when `index` missing / not a number / negative.
- `PATCH` 400 when `text` missing or empty after sanitize.
- `PATCH` 404 when index out of range.
- `PATCH` 404 when project missing.
- `DELETE` 200 happy path removes the targeted line.
- `DELETE` 400 when `index` missing/invalid.
- `DELETE` 404 when index out of range.
- `DELETE` 404 when project missing.

Lib (`redeye-files.test.ts` or a new `directive-mutate.test.ts`):

- `applyDirectiveEdit` replaces the Nth bullet, preserves surrounding `### subsection` headers, blank lines, and untouched bullets.
- `applyDirectiveEdit` skips `_(` placeholder lines when counting (parser parity).
- `applyDirectiveEdit` throws `RangeError` past end.
- `applyDirectiveDelete` removes the Nth bullet line cleanly.
- `applyDirectiveDelete` throws `RangeError` past end.

UI (`page.test.tsx`):

- Hovering a row reveals edit + delete buttons (assert by `aria-label`).
- Clicking trash shows confirm panel; Cancel restores normal view; Confirm fires DELETE then refetches.
- Clicking pencil shows textarea pre-filled with directive source + Save/Cancel.
- Save calls PATCH with the right `{ index, text }` and refetches on success.
- Error from PATCH shows inline error and keeps the editor open.

### Build verification

- `npx vitest run` — all green (currently 692, will grow).
- `npm run build` — clean.

## Sub-tasks

- [done] T1 — Add `applyDirectiveEdit` / `applyDirectiveDelete` lib helpers + unit tests
- [done] T2 — Add PATCH + DELETE handlers in steer route + tests
- [done] T3 — Refactor DirectiveRow with edit/delete UI + tests
- [done] T4 — Build verification (vitest + next build) — 731/731 tests pass, build clean.

## Out of Scope

- Reordering directives.
- Bulk delete.
- Undo / soft-delete.
