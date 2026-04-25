# BL-065 BUILD complete — Won't Do section shows Reason rationale

**Iteration:** 104
**Phase:** BUILD complete → REVIEW
**Backlog item:** BL-065 — Add Won't Do section at the end of the backlog page

## Sub-tasks

- T1 done — type + parser
  - Added `reason?: string` to `BacklogItem` (`lib/redeye-types.ts`)
  - `parseBacklog` now extracts the `Reason` field via existing `pickField`
    (`lib/redeye-parsers.ts`)
  - +3 unit tests in `lib/redeye-parsers.test.ts` (extracts on wont-do,
    undefined when absent, not coerced from Summary)

- T2 done — UI render
  - Exported `WontDoItemRow` from `app/project/[id]/backlog/page.tsx`
  - Renders reason as a second line beneath the title with a small `Reason`
    eyebrow + body text (`text-xs text-gray-500 dark:text-zinc-500 mt-1
    leading-snug`)
  - Strikethrough title link unchanged
  - `data-testid="wontdo-reason"` on the reason `<p>` for selectors
  - +3 component tests in `app/project/[id]/backlog/page.test.tsx`

- T3 done — verification
  - `npx vitest run` — **779/779 pass** (was 773, +6 new)
  - `npm run build` — clean

## Files modified

- `lib/redeye-types.ts`
- `lib/redeye-parsers.ts`
- `lib/redeye-parsers.test.ts`
- `app/project/[id]/backlog/page.tsx`
- `app/project/[id]/backlog/page.test.tsx`
- `docs/specs/BL-065-wont-do-section.md` (new)

## Commits

- `redeye: plan BL-065 — Won't Do section spec`
- `feat: BL-065 — extract Reason field on BacklogItem (task 1)`
- `feat: BL-065 — render Reason rationale in Won't Do rows (task 2)`
- `redeye: build BL-065 complete — ready for review` (final commit, this push)

## Notes / scope

- The collapsed Won't Do section itself was already in place from an earlier
  iteration (positioned below Done, count badge, chevron). The CEO's request
  specifically called out that the rationale for each rejected item must be
  visible — that was the gap. Implementation focuses tightly on extracting
  and rendering `**Reason:**`.
- No API route change needed — the existing `/api/projects/[id]` endpoint
  returns wont-do items via `recentlyShipped/upNext` after the wont-do parser
  fix, and `reason` rides along on the existing `BacklogItem` payload.
- E2E Playwright suite not added: `.redeye/config.md` defines no App URL for
  this task scope, and the existing `e2e/backlog-done-section.spec.ts` covers
  the structural pattern. The new render path is covered by component tests.

## Concerns

None. Pure additive change, no behaviour regression for items without a
Reason field.
