# RedEye Status

**Updated:** 2026-04-25 (iter 98 BUILD)
**Phase:** review
**Phase Status:** ready
**Backlog:** BL-071 — Apply Precision Instrument Design System Across All Pages
**Spec:** docs/specs/BL-071-design-system-propagation.md

## BUILD Result

All 5 sub-tasks completed. 691/691 tests pass. Clean build.

### T1 (L) — Mission control cards
- Switched all mission-control card borders from `border-l-4` to `border-t-[3px]` with status-driven colors:
  - WorkingOnCard: green-500 (running), amber-400 (waiting_for_ceo), zinc (idle)
  - ControlsCard: amber-500 (stalled), zinc (else)
  - QuestionsCard: red-500 (hasPending), zinc (else)
  - CostCard, ShippedCard, UpNextCard, HealthCard: zinc neutral
- Upgraded all card section labels to CARD-LABEL token (font-mono text-[11px] uppercase tracking-[0.18em]).
- Added project page header above ProjectNav in `app/project/[id]/layout.tsx`: Control Tower eyebrow + h1 with pulsing dot when running + monospace path + Running/Idle pill, separated by border-b divider.
- Upgraded "Backlog" / "Telemetry" rail labels in `app/project/[id]/page.tsx` to CARD-LABEL.

### T2 (S) — Tab page headers
Standard header pattern (eyebrow "Control Tower" + h1 + subtitle + border-b) added to:
- `/project/[id]/backlog` — h1 "Backlog", subtitle "{n} items", + Add Item action
- `/project/[id]/history` — h1 "History", subtitle "Sessions & iteration log"
- `/project/[id]/schedules` — h1 "Schedules", subtitle "{n} scheduled tasks"
- `/project/[id]/steer` — h1 "Steer", subtitle "Send directives to the team"
- Updated 2 tests (`schedules/page.test.tsx`, `steer/page.test.tsx`) to query the new h1 by accessible role/level.

### T3 (M) — Backlog list + detail
- ActiveTaskCard left rail: `border-l-4` → `border-l-2 border-l-green-500`.
- Other backlog rows in BacklogSection: added `border-l-2 border-l-transparent` for visual alignment.
- Backlog detail page (`backlog/[taskId]/page.tsx`): added breadcrumb `← Backlog`, eyebrow "Control Tower — Backlog", item title as h1, taskId in META-TEXT subtitle.
- Upgraded all dt labels (ID, Type, Section, Status, Cost) and h3 labels (Edit Item, Details, Spec File) to CARD-LABEL token.
- Upgraded shared `components/section-header.tsx` to use CARD-LABEL token (still preserves count badge styling).

### T4 (M) — History + Schedules + Steer
- History "Sessions" / "Iteration Log" labels already use SectionHeader (now CARD-LABEL via T3).
- ScheduleRow upgraded with `border-t-[3px]`: amber-400 (overdue), green-500 (on-schedule), zinc (never-run).
- Schedules section headings ("Overdue", "On schedule") upgraded to mono CARD-LABEL token.
- Steer DirectiveRow gained `border-t-[3px] border-t-zinc-300/700` neutral top border.
- Steer "Current Directives" h3 upgraded to CARD-LABEL.

### T5 (S) — Verification
- `npx vitest run`: 691/691 pass (68 test files).
- `npm run build`: clean compile.

## Files Modified

**Components:**
- `/Users/casa/ControlTower/components/mission-control/working-on-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/controls-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/questions-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/cost-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/shipped-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/up-next-card.tsx`
- `/Users/casa/ControlTower/components/mission-control/health-card.tsx`
- `/Users/casa/ControlTower/components/section-header.tsx`
- `/Users/casa/ControlTower/components/schedules/schedule-list.tsx`

**Pages:**
- `/Users/casa/ControlTower/app/project/[id]/layout.tsx`
- `/Users/casa/ControlTower/app/project/[id]/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/backlog/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/backlog/[taskId]/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/history/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/schedules/page.tsx`
- `/Users/casa/ControlTower/app/project/[id]/steer/page.tsx`

**Tests:**
- `/Users/casa/ControlTower/app/project/[id]/schedules/page.test.tsx`
- `/Users/casa/ControlTower/app/project/[id]/steer/page.test.tsx`

## Notes

- E2E Playwright tests not added: per `.redeye/config.md`, no E2E command is configured (only the `App URL: http://localhost:3200` is listed). Spec test plan calls for visual screenshots in dark/light, deferred to REVIEW/UX-reviewer.
- No new dependencies. Dark/light mode preserved on every changed surface.
- BacklogSummarySection was intentionally left with its `border-l-4 border-l-green-500` accent — that block is a content callout (LLM-authored summary), not a card-shell, so the precision-instrument top-border pattern doesn't apply.

## Ready For

REVIEW phase.
