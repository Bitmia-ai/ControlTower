# BL-067: Mission Control Page Redesign

## Problem

BL-071 applied precision-instrument tokens (border-t, eyebrow labels) to mission control cards. BL-067 goes deeper: the 3-column equal grid is unbalanced, WorkingOn lacks hero weight, Questions takes full width even when empty, and the Telemetry/Backlog section label rows add noise.

## Design Direction — Asymmetric Two-Column Command Layout

**Concept:** Hardened operations console. Left column = mission feed (what's happening). Right rail = control panel (act and monitor). WorkingOn becomes a genuine hero.

### Core Grid Change

Replace the 3-column equal grid with a **2-column asymmetric layout**:
```
grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 lg:items-start
```

Right rail is fixed 300px — enough for controls/cost/health without competing with the mission content.

### Left Column — Mission Feed
```
WorkingOnCard (hero)
QuestionsCard (full card when pending, minimal strip when empty)
grid sm:grid-cols-[2fr_1fr]:
  ShippedCard | UpNextCard
```

### Right Rail — Control Panel
```
ControlsCard
CostCard
HealthCard
```

## Per-Card Changes

**WorkingOnCard:**
- `p-5` → `p-6`, `min-h-[160px]`
- Task title `text-base` → `text-lg font-semibold`
- Subtle green wash when running: `bg-green-50/30 dark:bg-green-950/10`

**QuestionsCard:**
- When empty: collapse to a minimal strip (`border border-gray-100 dark:border-zinc-800 px-4 py-2.5 rounded-md bg-transparent`) instead of a full card box
- When pending: full card with red tint — unchanged

**ControlsCard:**
- `p-5` → `p-4` for right-rail density
- Add `border-t border-gray-100 dark:border-zinc-800 pt-3 mt-1` separator between stop/pause row and steer/backlog row

**CostCard (right rail):**
- Stack session/total vertically with `justify-between` row layout for the narrower 300px rail
- Sparkline stays full-width below

**Remove:**
- `Backlog` and `Telemetry` section label `<p>` rows
- Nested `md:col-span-3` sub-grid wrapper
- `md:items-start` on outer grid

## Sub-tasks

- **T1 (M) [done]:** Restructure `app/project/[id]/page.tsx` — new asymmetric grid, remove section labels, reorganize card positions
- **T2 (M) [in-progress]:** Update WorkingOnCard (hero padding/font), QuestionsCard (empty strip), ControlsCard (compact rail), CostCard (stacked layout)
- **T3 (S) [pending]:** Tests + build verification — fix any DOM test assertions, `npx vitest run`, `npm run build`

## Test Plan

- `npx vitest run` — all pass (762 currently)
- `npm run build` — clean
- Playwright: screenshot mission control in dark + light mode, verify asymmetric layout, hero WorkingOn, empty Questions strip
- Mobile: verify single-column stack order on narrow viewport
