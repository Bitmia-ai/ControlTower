# Review Notes: BL-066 — Redesign Home Page Project Cards

**Reviewer:** REVIEW agent (claude-sonnet-4-6)
**Date:** 2026-04-25
**Review cycle:** 1
**Verdict:** PASS

## Change Size

M-tier: 5 changed files (components/project-card.tsx, components/project-card.test.tsx, app/page.tsx, app/page.test.tsx, docs/specs/BL-066-home-page-redesign.md).

## Build & Test Results

- `npm run build`: clean (1 pre-existing turbopack workspace-root warning, unrelated to BL-066)
- `npx vitest run`: 691/691 tests pass (15 new tests added: 9 card + 2 header + 4 existing pass)

## Findings

### Critical — None

### Major — None

### Minor

**m-1: `backlogEmpty` heuristic is fragile**
`backlogEmpty = !project.running && project.phase === "HARDEN"` conflates two concepts: a project actively in the HARDEN phase (which is a real working phase) vs a project stuck idle with an empty backlog. In production a project can legitimately be in HARDEN with tasks remaining. However this logic was already present before BL-066 (carried over from PhaseBadge) and is out of scope for this redesign. No change needed here.

**m-2: Trailing `dark:border-t-zinc-700` in statusBorder initial value**
`statusBorder` is initialized as `"border-t-zinc-300 dark:border-t-zinc-700"` for the idle case. Both classes are concatenated into the outer div's className alongside `border-t-[3px]`. The `border-t-[3px]` sets the width; `border-t-zinc-300` sets the color. This is correct Tailwind usage — they do not conflict. No action needed.

**m-3: Delete confirmation button `handleDelete` has unreachable early-return branch from inline panel**
`handleDelete` has an early-return branch that sets `confirmDelete(true)` when `!confirmDelete`. Since the inline panel's "Remove" button only appears after `confirmDelete` is already true, this branch is unreachable from that context. The code is harmless and is a pre-existing pattern from before the redesign.

## Spec Compliance

| Spec requirement | Status |
|---|---|
| `border-t-[3px]` status border (green/amber/zinc) | DONE — `data-status-border` attribute + correct classes |
| Pulsing dot with `animate-ping` when running | DONE — hidden via conditional render when not running |
| Phase footer strip with PHASE_COLORS tint | DONE — `data-testid="phase-footer"` with dynamic class |
| Trash icon `opacity-0 group-hover:opacity-100` | DONE — `focus:opacity-100` also present (good a11y addition) |
| Monospace path text `font-mono text-[11px]` | DONE — `data-testid="project-path"` |
| Stop button bordered secondary style | DONE — white/bordered when running, red-600 when stopped |
| Page header eyebrow + border-b | DONE — `<header>` element with `border-b`, `font-mono` eyebrow |
| Delete confirmation inline (red-tinted panel) | DONE — `data-testid="delete-confirm-panel"` |
| Accessibility touch targets >= 44px | DONE — all buttons have `min-h-[44px]`, trash has `min-w-[44px]` |
| Dark mode variants | DONE — all color classes have `dark:` counterparts |

## Summary

0 Critical, 0 Major, 3 Minor (all pre-existing patterns, none requiring action).
Recommendation: **DEPLOY**

---

## VERIFY Result — Iteration 97

**Agent:** VERIFY (claude-sonnet-4-6)
**Date:** 2026-04-25T19:14:00Z
**Verdict:** PASS

### Visual Checklist

| Item | Result |
|---|---|
| "Control Tower" eyebrow label (monospace, small, muted) | PASS |
| "Projects" h1 heading | PASS |
| Project count subtitle ("3 projects registered") | PASS |
| border-b divider below header | PASS |
| Colored top border (3px): green (running), amber (backlog-empty/questions), zinc (idle) | PASS |
| Project name prominently displayed | PASS |
| Project path in monospace smaller text | PASS |
| Phase footer section at card bottom | PASS |
| Start / Stop button in footer | PASS |
| Dark mode — all elements render correctly | PASS |
| Console errors (new regressions) | NONE — 1 pre-existing SSR 500 (known Turbopack prerender issue, already documented in layout.tsx) |

### Outcome

Environment: healthy. Feature fully verified. Tagged `last-good-deploy-iter97-bl066`. Phase advanced to MERGE.

---

# Review Notes: BL-071 — Design System Propagation

**Reviewer:** REVIEW agent (claude-sonnet-4-6)
**Date:** 2026-04-25 (iter 98)
**Review cycle:** 1
**Verdict:** PASS

## Change Size

M-tier: 21 files changed (286 insertions / 143 deletions). Touches components, pages, tests.

## Build & Test Results

- `npx vitest run`: 691/691 pass (68 test files)
- `npm run build`: clean, all routes present

## Findings

### Critical — None

### Major — None

### Minor

**m-1: amber-500 vs amber-400 inconsistency — intentional per spec**
`components/mission-control/controls-card.tsx` uses `border-t-amber-500` (stalled). All other amber attention signals use `border-t-amber-400` (working-on-card, schedule-list, project-card). The spec explicitly specifies `amber-500` for ControlsCard stalled state. This is intentional differentiation. No change required.

**m-2: Residual old-style labels in out-of-scope files**
`components/backlog-summary-section.tsx`, `components/transcript-viewer.tsx`, `components/onboarding-wizard.tsx`, `components/add-backlog-dialog.tsx`, `components/add-project-dialog.tsx` still use `text-xs uppercase tracking-wide`. These files were not in BL-071 scope. Future migration opportunity.

## Token Consistency Check

All BL-071-scoped files use consistent design tokens:
- EYEBROW: confirmed on all 4 tab pages, layout, backlog detail
- CARD-LABEL: confirmed on all 8 mission-control cards, section-header, steer, schedule labels
- STATUS-TOP: `border-t-[3px]` with correct color semantics — all card shells
- H1: `text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight` — all 4 tab pages + layout
- DIVIDER: `border-b border-gray-200 dark:border-zinc-800` — all page headers

## Dark Mode

All new elements have correct `dark:` variants. No missing dark-mode classes found on changed surfaces.

## Touch Targets

- "Add Item" button: `min-h-[44px]` — confirmed
- Schedule expand buttons: `min-h-[44px]` — confirmed

## Regressions

- SectionHeader count badge: `font-sans` reset added to prevent mono leaking into count number — correct
- Breadcrumb on backlog detail preserved with correct link target
- Steer directive description text moved to paragraph below header (not removed)
- `BacklogSummarySection` left-border accent intentionally preserved as content callout
- Test assertions updated to match new h1 structure: `getByRole("heading", { name: "Schedules", level: 1 })` and `getByRole("heading", { name: "Steer", level: 1 })`

## Verdict

**PASS — 0 Critical / 0 Major / 2 Minor**

Both minor findings are non-actionable (spec-intentional or out-of-scope). Recommend DEPLOY.

---

# Review Notes: BL-065 — Won't Do Section

**Reviewer:** REVIEW agent (claude-sonnet-4-6)
**Date:** 2026-04-25 (iter 104)
**Review cycle:** 3 (final)
**Verdict:** PASS

## Change Size

S-tier: 3 files changed (page.tsx, page.test.tsx, state.json). 2 prior fix cycles corrected data plumbing and bucket logic.

## Build & Test Results

- `npm run build`: clean (1 pre-existing Turbopack workspace-root warning)
- `npx vitest run`: 779/779 pass (70 test files)

## Findings

0 Critical / 0 Major / 0 Minor

All sanity checks pass:
- `computeBuckets` wontDoItems: `status === "wontdo"` (not section)
- `plannedItems` excludes `status !== "wontdo"`
- `doneItems` no longer incorrectly filters by section
- Test uses items with status=wontdo in two different sections proving section-independence

## VERIFY Result

Won't Do section visible with 4 items (BL-069, BL-054, BL-030, BL-029). REASON eyebrow renders with rationale text for each item. Section collapsed by default. Wont-do items absent from planned section. Screenshot: bl065-verify-wontdo-section.png.

**Recommendation: DEPLOY + MERGE**
