# T056: Redesign backlog, history, and live tabs using designer sub-agent and frontend skill

**Status:** planned  
**Priority:** P2  
**Type:** feature  
**Added:** 2026-04-25 (iter 85)  
**Spec written:** 2026-04-25 (iter 86)

---

## Problem

The backlog, history, and live tabs were built incrementally and lack visual polish. Compared to the mission-control page (redesigned in T045), these tabs look bare:

- **Backlog tab** (`app/project/[id]/backlog/page.tsx`): flat list of cards with minimal differentiation. Priority badges, status chips, and section headers lack hierarchy. The "Currently Working On" card blends into the list.
- **History tab** (`app/project/[id]/history/page.tsx`): the Sessions section and Iteration Log are stylistically mismatched. No clear visual boundary between sections. Phase chips and cost badges from T053 look functional but not polished.
- **Live tab** (`app/project/[id]/live/page.tsx`): the toolbar (Expand/Collapse all, auto-scroll button) is minimal. The `TranscriptViewer` cards have basic styling. The empty/no-transcript states are plain.

The CEO requested these tabs be redesigned using the designer sub-agent and frontend skill, matching the polish of the mission-control page.

---

## Design Principles (from mission-control reference)

The mission-control page uses:
- `bg-white dark:bg-zinc-900` cards with `border border-gray-200 dark:border-zinc-800 rounded-xl`
- Section headers: `text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 font-medium`
- Red-600 accent color for highlights and active states
- Subtle `hover:bg-gray-50 dark:hover:bg-zinc-800/60` hover states on interactive rows
- `text-sm` body text, `text-xs` for metadata
- Consistent gap-4 / gap-3 spacing

---

## Sub-Tasks

### T1: Redesign the backlog tab list layout

**Files:** `app/project/[id]/backlog/page.tsx`  
**Goal:** Polish the active-task card, backlog section rows, done rows, and won't-do rows.

Changes:
1. **ActiveTaskCard**: Upgrade to a prominent card matching the WorkingOnCard style from mission-control. Add a pulsing green dot, bolder title, and clear "In Progress" badge. Add subtle left-border accent (green).
2. **BacklogSection rows** (planned/in-progress): Replace the flat border cards with a card that has rounded-xl corners, hover highlight, and better badge layout. Priority badges: P0 = red-600, P1 = orange-500, P2 = gray. Status chip on right side.
3. **DoneItemRow**: Keep the compact row style but add a faint checkmark icon (`lucide-react Check`) before the ID, and use a more visible green-tinted done chip (`bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-full`).
4. **WontDoItemRow**: Grey strikethrough text is good; add a faint `X` icon using `lucide-react X` for clarity.
5. **Section headers**: Add `mb-2 mt-6` spacing and use the standard pattern. Add item count badge next to each section label (e.g., "Triaged (3)").
6. **Collapsible done/won't-do sections**: The collapsed trigger should show the count prominently (e.g., "Show 48 completed items").
7. **Empty state**: Use the shared `EmptyState` component — already present, no change needed.

Tests: Update `app/project/[id]/backlog/page.test.tsx` to cover new count badge and icon rendering.

### T2: Redesign the history tab layout

**Files:** `app/project/[id]/history/page.tsx`, `components/history/session-history-row.tsx`  
**Goal:** Improve visual separation between Sessions and Iteration Log, polish the section headers and cards.

Changes:
1. **Sessions section header**: Add a calendar or clock icon (`lucide-react Clock`) before "Sessions". Add total session count badge.
2. **SessionHistoryRow** (`components/history/session-history-row.tsx`): Already has phase chips and cost badge. Improve hover state to `hover:bg-gray-50 dark:hover:bg-zinc-800/60`. Add a subtle left border that turns red-500 on hover. Make the row click-to-expand more obvious with a chevron icon.
3. **Phase chips** (`components/history/phase-chip.tsx`): Already well-styled. No changes needed.
4. **Iteration Log section header**: Add a `lucide-react GitBranch` icon before "Iteration Log". Add entry count badge.
5. **TimelineEntry** (inline in history page): Replace the dot + vertical line with a more refined timeline — use a filled circle with a subtle shadow, and a dashed connector line for better visual rhythm. Add a section divider between timeline entries (subtle horizontal rule or increased gap).
6. **Section boundaries**: Add a clear visual separator (`border-t border-gray-100 dark:border-zinc-800 my-6`) between Sessions section and Iteration Log section.
7. **Skeleton loading**: The SessionsSkeleton and any iteration log skeletons should use consistent `animate-pulse rounded-xl` cards.

Tests: Update `components/history/session-history-row.test.tsx` — check for chevron icon and hover class.

### T3: Redesign the live tab layout

**Files:** `app/project/[id]/live/page.tsx`, `components/transcript-viewer.tsx`  
**Goal:** Improve the toolbar design and the card styling in TranscriptViewer.

Changes:
1. **Toolbar** (Expand/Collapse all, auto-scroll): Wrap in a `sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-gray-100 dark:border-zinc-800` bar. Use icon buttons (lucide-react `ChevronsUpDown` for expand/collapse, `ArrowDown` for auto-scroll). Add tooltip text or `title` attribute.
2. **Connected/status badge**: Show "Live" badge (green pulse dot + "Connected") or "Offline" (gray) in the toolbar. Currently this is inlined in the page; move it to the toolbar area.
3. **Transcript viewer cards** (`components/transcript-viewer.tsx`): The `UserCard`, `AssistantCard`, and `ThinkingCard` should use `rounded-xl` instead of `rounded-lg`, and the card header (role label + chevron) should use the consistent small-caps label style.
4. **Empty/no-transcript state**: Replace the plain "No active session" text with the shared `EmptyState` component (icon + title + description). Use a `Terminal` icon from lucide-react.
5. **Session boundary marker**: The `__session_boundary__` separator ("— New session —") should be a styled horizontal divider with the text centered and a subtle background pill.

Tests: Update `components/transcript-viewer.test.tsx` — check for `rounded-xl` on cards and EmptyState import.  
Add a test to `app/project/[id]/live/page.test.tsx` (create this file) covering: toolbar renders, empty state renders when `running=false` and no transcript.

### T4: Shared — extract SectionHeader component

**File:** `components/section-header.tsx` (new)  
**Goal:** DRY up the repeated section-header pattern used across backlog, history, and live tabs.

```tsx
// components/section-header.tsx
interface SectionHeaderProps {
  icon?: React.ReactNode;
  label: string;
  count?: number;
  className?: string;
}
export function SectionHeader({ icon, label, count, className }: SectionHeaderProps) { ... }
```

Use `SectionHeader` in T1, T2, T3 wherever there is a `text-xs uppercase tracking-wide` section label.

Tests: `components/section-header.test.tsx` — renders label, renders icon when provided, renders count badge when provided.

### T5: Quality gate — unit tests pass, no regressions

**Goal:** Ensure 100% of existing tests still pass after all UI changes.

1. Run `npx vitest run` — all tests must pass (current baseline: 627 tests)
2. New tests from T1–T4 must all pass
3. Fix any snapshot or assertion failures caused by the new class names or component structure

### T6: E2E smoke — verify three tabs render correctly

**Goal:** Light E2E verification that redesigned tabs load without error.

File: `tests/e2e/tab-redesign.spec.ts` (new Playwright spec)

Tests:
1. Backlog tab: navigate to `/project/0/backlog`, verify the page loads, section headers are present, no JS errors
2. History tab: navigate to `/project/0/history`, verify Sessions section and Iteration Log section are present
3. Live tab: navigate to `/project/0/live`, verify the toolbar and empty-state render

---

## Scope Exclusions

- No changes to the mission-control (Overview) tab
- No changes to the Schedules tab (shipped in T055)
- No new API endpoints
- No new data fetching logic
- Editing of backlog items in-page (deferred to a future backlog item)
- Dark mode screenshots / visual regression (deferred — requires Playwright visual testing setup)

---

## Test Baseline

Current: 627 unit tests passing (as of iter 85 T055 merge).

Expected after T056: 640+ unit tests (13+ new across T1–T4 and T6).

---

## Files to Change

| File | Change |
|------|--------|
| `app/project/[id]/backlog/page.tsx` | T1 redesign |
| `app/project/[id]/history/page.tsx` | T2 redesign |
| `app/project/[id]/live/page.tsx` | T3 redesign |
| `components/transcript-viewer.tsx` | T3 card style |
| `components/history/session-history-row.tsx` | T2 polish |
| `components/section-header.tsx` | T4 new component |
| `components/section-header.test.tsx` | T4 tests |
| `tests/e2e/tab-redesign.spec.ts` | T6 new E2E |
| Existing test files (backlog, history, live) | T5 updates |
