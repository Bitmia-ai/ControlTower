# BL-057: Mobile-Responsive Layout

**Status:** planned  
**Priority:** P1  
**Added:** 2026-04-25 (iter 88)

## Goal

Make the Control Tower dashboard fully usable on phones (≥320px) and tablets (≥768px). All pages should work correctly at the Tailwind `sm` (640px) and `md` (768px) breakpoints. No new CSS libraries or dependencies — Tailwind responsive prefixes only.

## Architecture Decisions

1. **No new libraries.** Tailwind's `sm:`, `md:`, `lg:` responsive prefixes cover all needs. The app already uses Tailwind; no config changes required.
2. **Mobile-first column stacking.** Cards default to single-column on mobile, expand to multi-column on `md:` and above. The existing `md:grid-cols-3` pattern in the mission control page is the right model.
3. **Touch targets ≥44×44px.** All interactive buttons/links must meet WCAG 2.5.5 minimum target size on mobile. This means `min-h-[44px]` or `py-3` on small touch targets.
4. **Overflow-x containment.** The global `<body>` must not overflow horizontally on small screens. Any element that causes overflow (wide tables, transcript cards, code blocks) must be clipped with `overflow-x-hidden` or `overflow-x-auto` as appropriate.
5. **Header stays fixed-height.** The global header (logo + theme toggle) is already responsive (`px-6 py-4`). Minor adjustment needed for very narrow screens.
6. **ProjectNav already has `overflow-x-auto`.** The 5-tab nav already scrolls horizontally. No change needed.
7. **Test viewports:** 375×667 (iPhone SE) and 768×1024 (iPad). Playwright `page.setViewportSize()` is used in tests.

## Scope

Pages and components to audit and fix:

| Page / Component | Current state | Key changes needed |
|---|---|---|
| `app/layout.tsx` (global header) | `px-6 py-4` | Reduce px to `px-4 sm:px-6` on mobile |
| `app/page.tsx` (home) | Grid already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | "Add Project" button needs larger touch target; title/subtitle stack OK |
| `app/project/[id]/layout.tsx` (project header) | `px-4 sm:px-6` | Path truncation may need `max-w-full`; nav overflow OK |
| `app/project/[id]/page.tsx` (mission control) | `grid-cols-1 md:grid-cols-3` | Cards stack on mobile — OK; "Backlog" section labels hidden on mobile are fine |
| `components/mission-control/controls-card.tsx` | Fixed-width buttons | Button row may overflow on 320px; needs flex-wrap |
| `components/mission-control/cost-card.tsx` | Sparkline chart | SVG width must be responsive (`width="100%"`) |
| `app/project/[id]/backlog/page.tsx` | Full-width rows | Item rows have flex row with badge cluster — needs wrapping on narrow screens |
| `app/project/[id]/backlog/[taskId]/page.tsx` | Detail dl layout | `<dl>` grid may overflow; needs `grid-cols-1 sm:grid-cols-2` |
| `app/project/[id]/history/page.tsx` | Timeline + sessions | Phase chip strip may overflow; needs `overflow-x-auto` on chip container |
| `app/project/[id]/live/page.tsx` | Sticky toolbar | Toolbar flex row may overflow; needs `flex-wrap gap-2` on action buttons |
| `app/project/[id]/schedules/page.tsx` | Schedule list rows | Status/next-due badges may overflow narrow screens |
| `components/transcript-viewer.tsx` | Tool cards | Code output blocks need `overflow-x-auto`, `break-all` on long strings |
| `components/project-card.tsx` | Card in grid | Already responsive (grid handles it); confirm touch targets on Start/Stop button |

## Sub-tasks

### T1: Global layout and home page (S)

**Files:** `app/layout.tsx`, `app/page.tsx`, `components/project-card.tsx`

**Changes:**
- `app/layout.tsx`: header `px-6` → `px-4 sm:px-6`; ensure logo and theme toggle don't clip on 320px
- `app/page.tsx`: "Add Project" button `py-2` → `py-2.5 min-h-[44px]`; verify title/count row wraps correctly
- `components/project-card.tsx`: Start/Stop button ensure `min-h-[44px]`; card touch area already covers full card

**Test strategy:** Unit test that `ProjectCard` renders with correct class structure (existing tests cover render); new Playwright E2E at 375×667: verify all project cards visible, no horizontal overflow, "Add Project" button tappable.

**Acceptance criteria:**
- Home page renders without horizontal scroll at 375px width
- "Add Project" button has visible touch target ≥44px height
- Project cards stack 1-column at 375px, 2-column at 640px, 3-column at 1024px
- Status: done

---

### T2: Project layout header and mission control page (S)

**Files:** `app/project/[id]/layout.tsx`, `app/project/[id]/page.tsx`

**Changes:**
- Layout: project path `max-w-lg` → `max-w-full`; confirm header doesn't overflow at 375px
- Mission control grid already `grid-cols-1 md:grid-cols-3`; verify all cards render correctly at 375px
- Section labels (`hidden md:block`) are already hidden on mobile — intentional

**Test strategy:** Playwright E2E at 375×667: navigate to mission control, verify Working On card renders, Controls card renders, no horizontal overflow.

**Acceptance criteria:**
- Mission control page renders single-column at 375px without overflow
- All cards (Working On, Controls, Cost, Questions, Shipped, Up Next, Health) visible and scrollable
- Status: done

---

### T3: Controls card button layout (S)

**Files:** `components/mission-control/controls-card.tsx`

**Changes:**
- Read and audit the controls card; ensure Start/Stop/Pause/Restart/Steer/Add-Backlog buttons wrap correctly at 320px
- Any button row with multiple buttons should use `flex flex-wrap gap-2` instead of fixed `gap-3`
- All buttons: ensure `min-h-[44px]` or equivalent `py` padding

**Test strategy:** Unit test: existing tests cover render; visual check via Playwright at 375×667.

**Acceptance criteria:**
- All control buttons visible and tappable at 375px, no overflow
- Button layout wraps gracefully when viewport is narrow
- Status: done

---

### T4: Sparkline chart responsive width (S)

**Files:** `components/mission-control/sparkline-chart.tsx`

**Changes:**
- The SVG sparkline currently uses fixed pixel width; change to use a container `ref` or CSS `width: 100%` approach so it fills the card on any viewport
- If the component uses fixed `width` prop on `<svg>`, switch to `width="100%" viewBox="0 0 {W} {H}"` pattern with appropriate height

**Test strategy:** Existing unit tests for sparkline still pass; Playwright at 375×667: cost card shows sparkline, no overflow.

**Acceptance criteria:**
- Sparkline chart fills its container width at all viewport sizes
- No fixed-pixel overflow from sparkline SVG
- Status: done (already responsive — width="100%" with viewBox, confirmed during T4 audit)

---

### T5: Backlog list and detail page (S)

**Files:** `app/project/[id]/backlog/page.tsx`, `app/project/[id]/backlog/[taskId]/page.tsx`

**Changes:**
- Backlog list item rows: badge cluster (priority + status) may cause overflow on narrow screens. Use `flex-wrap` on the badge container and ensure the title truncates with `min-w-0 flex-1`
- Backlog detail page: `<dl>` field grid may use fixed columns; switch to `grid-cols-1 sm:grid-cols-2`
- "Add Item" button: ensure `min-h-[44px]`

**Test strategy:** Playwright at 375×667: navigate to backlog list, verify rows render without overflow; navigate to backlog detail, verify fields readable.

**Acceptance criteria:**
- Backlog list rows display correctly at 375px (title truncates, badges wrap or are visible)
- Backlog detail page fields readable at 375px without horizontal scroll
- Status: done

---

### T6: History, schedules, and live pages (M)

**Files:** `app/project/[id]/history/page.tsx`, `app/project/[id]/schedules/page.tsx`, `app/project/[id]/live/page.tsx`, `components/transcript-viewer.tsx`

**Changes:**
- History: session rows have phase chip strip — wrap in `overflow-x-auto` container; SessionHistoryRow expanded view should stack vertically on mobile
- Schedules: schedule rows with status badge + next-due column — use `flex-wrap` or hide secondary columns on mobile with `hidden sm:block`
- Live: sticky toolbar action buttons — use `flex-wrap gap-1.5` to wrap onto two lines on very narrow screens
- TranscriptViewer: tool output code blocks — add `overflow-x-auto break-all` to pre/code elements; long file paths should wrap

**Test strategy:** Playwright at 375×667: navigate to history page (verify sessions visible), schedules page (verify list visible), live page (verify toolbar visible, transcript cards visible). Unit tests for SessionHistoryRow and ScheduleList verify rendering.

**Acceptance criteria:**
- History page: session rows and iteration log readable at 375px; phase chips scroll horizontally within their row without causing page overflow
- Schedules page: schedule list items readable at 375px
- Live page: sticky toolbar visible at 375px; transcript cards don't cause horizontal page overflow
- Status: done

---

### T7: Unit tests for responsive behavior (S)

**Files:** New test file `components/__tests__/responsive.test.tsx` (or additions to existing tests)

**Changes:**
- Add unit tests verifying that key components include the expected responsive Tailwind classes
- Test `ProjectCard` has `min-h-[44px]` or equivalent on interactive buttons
- Test `ProjectNav` has `overflow-x-auto` on the nav element (already present — confirm in test)
- Test `SparklineChart` SVG uses `width="100%"` after T4 fix
- Vitest render tests — no DOM size measurement needed (class assertions only)

**Test strategy:** `npx vitest run` must pass 646+ tests after this task.

**Acceptance criteria:**
- All new tests pass
- Total vitest suite still passes
- Status: done

---

### T8: Playwright E2E spec for mobile viewports (S)

**Files:** `e2e/mobile-responsive.spec.ts` (new)

**Changes:**
- Write a Playwright spec that runs at 375×667 (iPhone SE) and 768×1024 (iPad)
- At each viewport: check no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`), key pages load, key UI elements visible

```typescript
// Rough structure (implementer fills in details):
test.describe('mobile 375px', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test('home page — no overflow', async ({ page }) => { ... });
  test('mission control — cards visible', async ({ page }) => { ... });
  test('backlog list — no overflow', async ({ page }) => { ... });
});

test.describe('tablet 768px', () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test('home page — 2-column grid', async ({ page }) => { ... });
  test('mission control — 3-column layout', async ({ page }) => { ... });
});
```

**Acceptance criteria:**
- No horizontal overflow at 375px on home, mission control, backlog, history, live, schedules pages
- Mission control grid is 1-column at 375px, transitions to 3-column at md:
- All Playwright assertions pass against http://localhost:3200
- Status: done

## Questions for CEO

None — mobile-responsive layout is well-defined with no external dependencies. Proceeding without CEO questions.

## Out of Scope

- Adding/removing navigation items
- Changing the information architecture
- Changing any dark/light mode colors
- Performance optimization beyond what responsive layout brings
- Native mobile app (this is web-responsive only)
