# BL-071: Apply Precision Instrument Design System Across All Pages

## Problem

BL-066 shipped the "Precision Instrument" aesthetic on the home page (3px status borders, animate-ping dots, phase footer strips, eyebrow typography). The remaining pages — mission control, backlog, history, schedules, steer — still use the old mixed styling with `border-l-4` left borders, non-monospace labels, and no consistent page header pattern.

## Design Tokens (established by BL-066, propagated here)

```
EYEBROW:    font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500
H1:         text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight
SUBTITLE:   text-sm text-gray-500 dark:text-zinc-500 mt-1
DIVIDER:    border-b border-gray-200 dark:border-zinc-800
CARD-BASE:  bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden
CARD-LABEL: font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500
META-TEXT:  font-mono text-[11px] text-gray-500 dark:text-zinc-500
STATUS-TOP: border-t-[3px] (green-500=running, amber-400=attention, zinc-300/700=idle)
```

## Changes Per Area

### T1: Mission Control Cards

Replace `border-l-4` with `border-t-[3px]` on all mission control cards:
- **WorkingOnCard**: `border-t-green-500` (running), `border-t-amber-400` (waiting_for_ceo), `border-t-zinc-300 dark:border-t-zinc-700` (idle)
- **ControlsCard**: `border-t-amber-500` (stalled), else zinc
- **QuestionsCard**: `border-t-red-500` (hasPending), else zinc
- **CostCard, ShippedCard, UpNextCard**: zinc (neutral)

Upgrade card section labels from generic `text-xs uppercase tracking-wide` → CARD-LABEL token (monospace).

Add a proper page header above ProjectNav in the project layout:
- "Control Tower" eyebrow
- Project name as h1 with pulsing dot when running
- Monospace project path as subtitle
- Running/Idle status pill

### T2: Tab Page Headers (all tabs)

Each tab page (`/project/[id]/backlog`, `/history`, `/schedules`, `/steer`) gets a standard header block:

```
<header pt-8 pb-5 mb-6 border-b>
  eyebrow: "Control Tower"
  h1: page title
  subtitle: item count or description
  action: (page-specific CTA, e.g. Add Item on backlog)
</header>
```

Per-page specifics:
| Page | Eyebrow | Title | Subtitle |
|------|---------|-------|----------|
| Backlog | `Control Tower` | `Backlog` | `{n} items` |
| History | `Control Tower` | `History` | `Sessions & iteration log` |
| Schedules | `Control Tower` | `Schedules` | `{n} scheduled tasks` |
| Steer | `Control Tower` | `Steer` | `Send directives to the team` |

### T3: Backlog List + Detail

**Backlog list**: in-progress item gets `border-l-2 border-l-green-500`; others get `border-l-2 border-l-transparent` for spacing.

**Backlog detail**: breadcrumb `← Backlog` above header, then eyebrow `"Control Tower — Backlog"` + item title as h1 + taskId in META-TEXT as subtitle.

Section headers within the page (status info, description) → CARD-LABEL token.

### T4: History + Schedules + Steer

**History**: section headers ("Sessions", "Iteration Log") → CARD-LABEL token.

**Schedules**: schedule rows upgrade to CARD-BASE + `border-t-[3px]` (overdue=amber, on-schedule=green, no-run=zinc).

**Steer**: directive rows upgrade to CARD-BASE + neutral zinc top border.

## Sub-tasks

- **T1 (L):** Mission control cards — border-t, label tokens, page header above nav
- **T2 (S):** Tab page headers — standard eyebrow/h1/divider pattern across all tabs
- **T3 (M):** Backlog list + detail — border-l status signal, detail page header, section label tokens
- **T4 (M):** History + Schedules + Steer — section label tokens, card upgrades
- **T5 (S):** Tests + build verification — update any snapshot/DOM tests, `npm run build`, `npx vitest run`

## Test Plan

- `npx vitest run` — all tests pass after each sub-task
- `npm run build` — clean build at end
- Playwright: screenshot mission control, backlog, history, schedules, steer in dark + light mode
- No new dependencies
- Dark/light mode must work throughout
