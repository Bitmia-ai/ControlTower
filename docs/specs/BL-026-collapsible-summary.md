# BL-026 — Collapsible LLM Summary for Completed Backlog Items

## Current State

### Data Format

Completed backlog items in `.redeye/backlog.md` carry a `- **Summary:**` field
as a single-line bullet immediately after the `- **Status:** done` line. Example
from BL-048:

```
- **Summary:** User message boxes in the Live tab transcript are now collapsible
  and collapsed by default, reducing visual noise. A sticky Collapse All / Expand
  All toolbar was added to let users toggle all boxes at once without losing their
  scroll position.
```

All recent done items (BL-040 through BL-048) have this field. Older items
(BL-001 through BL-039) may have it or not. The field is a **single-line value**
after the `**Summary:**` marker — multi-line wrapping in the raw file is not used.

### Parser Status — NOT parsed

`parseBacklog()` in `lib/redeye-parsers.ts` calls `pickField(body, fieldName)`
for Type, Priority, Status, Spec — but **never calls `pickField(body, "Summary")`**.
As a result `BacklogItem` objects carry no summary data at all today.

The `BacklogItem` interface in `lib/redeye-types.ts` has no `summary` field.

### UI Status — not shown anywhere

- `app/project/[id]/backlog/[taskId]/page.tsx` — renders Type, Section, Status,
  Cost (est.), Details, and Spec. No summary section.
- `components/mission-control/shipped-card.tsx` — shows ID + title + cost per
  item. No summary.

---

## Architecture Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| AD-1 | Add `summary?: string` to `BacklogItem` | Minimal type extension; all consumers benefit. |
| AD-2 | Parse via existing `pickField(body, "Summary")` | No new parsing infrastructure required; the field is a single-line bullet identical to Type/Priority/Spec. |
| AD-3 | Collapsible via local `useState` in a new `SummarySection` component | Keeps the client component boundary in one place; reusable in both surfaces. |
| AD-4 | Expanded by default for done items; collapsed by default for all others | Done items are the primary value — summary is the main thing to read on the detail page. Non-done items may have a summary edge case (pre-written) but it should not dominate the screen. |
| AD-5 | Preview = first 120 characters + "…" when collapsed | Enough to convey topic without overflow. |
| AD-6 | Only render section when `summary` field is non-empty | Many in-progress/planned items will have no summary. |
| AD-7 | Keep `ShippedCard` tooltip/inline approach lightweight | The card is narrow; full collapsible would be too heavy. Show a truncated one-liner (≤80 chars) inline beneath the title when summary exists. No expand in the card — link to detail page for full text. |
| AD-8 | No changes to PATCH/write logic | The `Summary:` field is written by the CTO agent at VERIFY time, not by the dashboard. Editing summaries is out of scope. |

---

## Sub-task Decomposition

### T1 — Parser + type extension (S)

**Agent:** Dev (generic / sonnet)
**Files touched:**
- `lib/redeye-types.ts` — add `summary?: string` to `BacklogItem`
- `lib/redeye-parsers.ts` — add `pickField(body, "Summary")` inside `parseBacklog` item loop; assign to `summary`

**Test strategy:**
- Unit tests in `lib/redeye-parsers.test.ts` (existing file) or a new
  `lib/redeye-parsers-summary.test.ts`:
  - Item with `- **Summary:** Some text` → `summary === "Some text"`
  - Item without Summary field → `summary === undefined`
  - Multi-word summary preserved verbatim
  - Existing fields (Type, Status, etc.) unaffected

**Acceptance criteria:**
- `parseBacklog` returns `summary` populated for items that have the field
- `summary` is `undefined` for items that lack it
- All existing 430 tests still pass

**Status:** pending
**Dependencies:** none

---

### T2 — Backlog detail page collapsible UI (S)

**Agent:** Dev (generic / sonnet)
**Files touched:**
- `app/project/[id]/backlog/[taskId]/page.tsx` — add collapsible summary section
- `components/backlog-summary-section.tsx` (new) — `SummarySection` client component

**Component spec (`SummarySection`):**
```tsx
interface SummarySectionProps {
  summary: string;
  defaultOpen?: boolean; // true for done items
}
```
- Renders a bordered section below the `<dl>` grid and above Details
- Header row: label "Summary" (same style as "Details" section header) + chevron button (`aria-expanded`, `aria-controls`)
- When open: full summary text in `text-sm text-gray-700 dark:text-zinc-300`
- When closed: first 120 chars + "…" in muted color + "Show more" label
- Chevron rotates 180° when open (CSS `transition-transform`)
- Green left border accent (`border-l-4 border-l-green-500`) to visually distinguish from Details

**Insertion point in page.tsx:** Between the `</dl>` and the `{item.details &&` block. Only render when `item.summary` is truthy.

**Test strategy:**
- Unit test `components/backlog-summary-section.test.tsx`:
  - Renders full text when `defaultOpen={true}`
  - Renders truncated preview when `defaultOpen={false}` and text > 120 chars
  - Clicking chevron toggles expanded/collapsed
  - Does not render when summary is empty string (edge case)
  - `aria-expanded` attribute reflects open state

**Acceptance criteria:**
- Summary section appears below the metadata grid for done items with a summary
- Expanded by default for `status === "done"`, collapsed for others
- Collapsed state shows ≤120-char preview with "Show more"
- Expanded state shows full text
- Chevron rotates on toggle
- Section absent when item has no summary

**Status:** pending
**Dependencies:** T1 (parser must populate `summary`)

---

### T3 — ShippedCard inline summary snippet (S)

**Agent:** Dev (generic / sonnet)
**Files touched:**
- `components/mission-control/shipped-card.tsx`

**Design:** Below each item's title line, when `item.summary` is truthy, render a
one-liner summary snippet (≤80 chars + "…") in `text-xs text-gray-400 dark:text-zinc-500`.
No expand toggle in the card — the card is dense. The detail page link (via `BacklogId`)
gives the CEO the full summary.

The snippet only renders in the `BacklogItem[]` branch (not the changelog branch) since
changelog entries are `ChangelogEntry` objects which have no summary.

**Test strategy:**
- Add cases to `components/mission-control/shipped-card.test.tsx` (existing file):
  - Item with short summary (≤80 chars) → shown verbatim
  - Item with long summary (>80 chars) → truncated with "…"
  - Item without summary → no snippet element rendered
  - Snapshot or text-content assertion

**Acceptance criteria:**
- Recently Shipped card shows a muted one-line summary snippet for items that have one
- Items without summary are unchanged
- Changelog branch (hasChangelog path) unaffected

**Status:** pending
**Dependencies:** T1

---

### T4 — Tests + verification (S)

**Agent:** QA Lead (sonnet)
**Files touched:**
- All new/modified test files from T1–T3
- Playwright E2E smoke (optional — navigate to a done item detail page, assert summary section visible)

**Test strategy:**
- `npx vitest run` — all tests pass (target: 430+ passing)
- Playwright: navigate to a done backlog item with a known summary (e.g. BL-048),
  assert `data-testid="summary-section"` is visible and contains expected text fragment

**Acceptance criteria:**
- Full test suite passes
- Summary section renders in browser for a real done item

**Status:** pending
**Dependencies:** T1, T2, T3

---

## Files Touched (complete list)

| File | Change |
|------|--------|
| `lib/redeye-types.ts` | Add `summary?: string` to `BacklogItem` |
| `lib/redeye-parsers.ts` | Parse Summary field in `parseBacklog` |
| `lib/redeye-parsers.test.ts` | New summary parse tests |
| `components/backlog-summary-section.tsx` | New collapsible component |
| `components/backlog-summary-section.test.tsx` | Unit tests for component |
| `app/project/[id]/backlog/[taskId]/page.tsx` | Render `<SummarySection>` when `item.summary` exists |
| `components/mission-control/shipped-card.tsx` | Inline summary snippet in BacklogItem branch |
| `components/mission-control/shipped-card.test.tsx` | New summary snippet tests |

---

## Acceptance Criteria (feature-level)

1. A done backlog item with a Summary field shows a collapsible "Summary" section
   on its detail page, expanded by default.
2. Collapsing the section shows a ≤120-char preview and a chevron pointing down.
3. Expanding shows the full summary text.
4. Items with no summary field show no summary section.
5. The Recently Shipped card shows a ≤80-char inline snippet for items with a summary.
6. All tests pass (`npx vitest run`).
7. Playwright: navigating to a done item with a summary shows the section.
