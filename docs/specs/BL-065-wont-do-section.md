# BL-065 — Add Won't Do section at the end of the backlog page

## Problem

The backlog page already has a collapsed "Won't Do" section (added previously) that
lists wontdo items, but it does **not** show the `**Reason:**` rationale that agents
typically write when marking an item wont-do. Without that rationale visible, the CEO
cannot audit why specific items were rejected — the items themselves are listed but
the *why* is silently dropped.

## Goals

1. `parseBacklog` extracts the `**Reason:**` field from each item's body and exposes
   it on `BacklogItem.reason`.
2. The backlog page's `WontDoItemRow` renders that reason inline beneath the title
   when present.
3. Existing layout (collapsed-by-default Won't Do section, count badge, position at
   the bottom under Done) is preserved — nothing else changes visually.

## Non-goals

- No API/route changes — the existing `/api/projects/[id]` endpoint already returns
  every backlog item (including wontdo ones) via `upNext + recentlyShipped` after the
  parser fix in BL-* (wont-do classification). The Reason field rides along.
- No new section labels or design tokens.
- Done items keep their compact one-line presentation (no reason field for done).

## Scope of change

### `lib/redeye-types.ts`

- Add optional field `reason?: string` to `BacklogItem`.

### `lib/redeye-parsers.ts`

- In `parseBacklog`, after `pickField(body, "Status")`, also `pickField(body, "Reason")`.
- Include `reason` in the constructed `BacklogItem` (undefined if absent).
- `pickField` already handles single-line fields — Reason values in `backlog.md` are
  always single-line (one paragraph on the same `- **Reason:** …` line), so no
  multi-line block parsing needed.

### `app/project/[id]/backlog/page.tsx`

- `WontDoItemRow` shows the reason as a second line beneath the title when present:
  - Class: `text-xs text-gray-500 dark:text-zinc-500 mt-1 leading-snug`
  - Wraps; no truncation. The full sentence must be readable.
- Wrap the title + reason in the existing `flex-1 min-w-0` div so the row keeps its
  current flex layout (id+title row, then reason row, badges on the right).

## Tests (TDD)

### `lib/redeye-parsers.test.ts`

1. `parseBacklog` extracts `reason` field from a wontdo item.
2. `parseBacklog` returns `reason: undefined` when the field is absent.
3. `parseBacklog` works on the existing fixture (status normalisation still passes).

### `app/project/[id]/backlog/page.test.tsx`

1. Render `WontDoItemRow` with a `reason` — it appears in the DOM with the documented
   class.
2. Render `WontDoItemRow` without a `reason` — only the title row renders, no extra
   `<p>` element.
3. The title link still uses the strikethrough decoration in either case.

(Existing tests for `computeBuckets`, `CollapsibleSection`, etc. continue to pass
unchanged.)

## Sub-tasks

- [x] T1 (status: done) — Type + parser: add `reason` to `BacklogItem`, extract
      it in `parseBacklog`, add 3 unit tests.
- [x] T2 (status: done) — UI: render reason in `WontDoItemRow`, export the
      component for testing, add 3 component tests.
- [x] T3 (status: done) — Verify: `npx vitest run` 779/779 pass, `npm run build`
      clean.

## Risks

- **None significant.** Pure additive change. `reason` is optional everywhere; old
  fixtures without the field continue to work.
- The wontdo-section position and collapse behaviour are already in place.
