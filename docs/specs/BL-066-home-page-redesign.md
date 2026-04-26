# BL-066: Redesign Home Page Project Cards

## Problem

The home page project cards are functional but visually plain. The project name, phase, task, and status indicators exist but are presented with insufficient visual hierarchy. The cards are hard to scan quickly, and the running/blocked/idle states are not immediately obvious.

## Design Direction — "Precision Instrument"

Control Tower monitors autonomous AI agents — this is a *command center*, not a generic SaaS dashboard. The aesthetic targets high-end monitoring hardware: dark precision, sharp signal clarity, purposeful density.

**Core concept:** Cards as *status panels* — each card communicates its state at a glance through structural color.

### Key design changes

1. **Top border as status signal** — `border-t-[3px]` shifts by run state:
   - `border-t-green-500` = actively running
   - `border-t-amber-400` = idle but has pending questions (needs attention)
   - `border-t-zinc-300/700` = clean idle

2. **Pulsing dot inline with project name** — `animate-ping` running indicator before the project name. Hidden when idle.

3. **Phase footer strip** — Phase badge moved to a dedicated footer section with a tinted background from PHASE_COLORS. Gives phase more visual weight as a persistent footer.

4. **Trash icon on hover** — `opacity-0 group-hover:opacity-100` keeps delete discoverable without cluttering default state.

5. **Monospace path text** — Project path in `font-mono text-[11px]` visually signals it's a filesystem path.

6. **Footer Start/Stop styling** — Stop uses bordered secondary style; Start retains red-600 CTA.

7. **Page header divider** — `border-b` under header with monospace "Control Tower" eyebrow label above "Projects".

8. **Delete confirmation inline** — Red-tinted panel inline with card body.

## Files to Change

- `components/project-card.tsx` — full redesign
- `app/page.tsx` — header section update (eyebrow label, border-b divider)
- `__tests__/project-card.test.tsx` (or similar) — update tests to reflect new structure

## Sub-tasks

- **T1 (M) [done]:** Redesign `ProjectCard` component — status border, pulsing dot, phase footer strip, hover-reveal delete, inline delete confirmation
- **T2 (S) [done]:** Update `app/page.tsx` header — eyebrow label, border-b divider, count
- **T3 (S) [done]:** Update/add unit tests for new card structure; verify dark+light mode with Playwright screenshots

## Test Plan

- Unit tests: project name renders, pulsing dot shown when running, question count badge shown, phase footer renders, delete confirmation toggle
- Playwright: screenshot home page in dark and light mode, verify running state visual, verify idle state visual
- Build must be clean: `npm run build`
- All tests pass: `npx vitest run`
