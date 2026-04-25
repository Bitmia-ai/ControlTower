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
