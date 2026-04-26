# BL-004: Polish UI Consistency

## Overview

Add proper loading states, error boundaries, empty states, correct nav highlighting, and responsive layout polish across all pages in the Control Tower dashboard.

## Architecture Decisions

1. **Keep client-side data fetching pattern** -- all pages currently use `useEffect` + `useState` for fetching. Adding Next.js `loading.tsx` files would only show during route transitions (not during client-side fetches), so we add both: `loading.tsx` for initial route load and improve inline loading/error states for client-side fetching.

2. **Extract shared project nav into layout** -- the nav tabs (Overview, Backlog, History, Live) are duplicated across 5 page files with hardcoded active detection. Extract into a shared `ProjectNav` component in `app/project/[id]/layout.tsx` that uses `usePathname()` for correct highlighting. This removes ~30 lines of duplication per page.

3. **Add `error.tsx` boundaries** -- Next.js error boundaries at `app/error.tsx` and `app/project/[id]/error.tsx` catch unhandled render errors with a user-friendly reset button.

4. **Standardize empty state component** -- create a reusable `EmptyState` component with icon, message, and optional action button to replace the 4 ad-hoc empty states.

5. **Add inline error state for fetch failures** -- currently all `catch` blocks silently ignore errors. Add a `fetchError` state variable and show a retry-able error message when API calls fail.

6. **Responsive approach** -- the app already uses Tailwind responsive classes. Polish: ensure cards stack on mobile, nav scrolls horizontally if needed, and dialog/modal widths adapt.

## Sub-Tasks

### T1: Extract shared ProjectNav component
- **Size:** S
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; nav renders on all project pages; active tab matches current route
- **Acceptance criteria:**
  - New `components/project-nav.tsx` component using `usePathname()` for active detection
  - `app/project/[id]/layout.tsx` updated to include header + nav (back link, project name, status dot, nav tabs)
  - Remove duplicated nav, header, and back link from all 5 project pages (overview, backlog, backlog detail, history, live)
  - Active tab has red bottom border; inactive tabs have transparent border
  - Build passes with `npm run build`
- **Status:** done

### T2: Add loading.tsx files for route transitions
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; skeleton/spinner shown during route transitions
- **Acceptance criteria:**
  - `app/loading.tsx` -- spinner centered on page
  - `app/project/[id]/loading.tsx` -- skeleton matching project page layout
  - Consistent loading spinner/skeleton style using zinc colors
  - Build passes
- **Status:** done

### T3: Add error.tsx boundaries
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; error boundary renders when child throws
- **Acceptance criteria:**
  - `app/error.tsx` -- "Something went wrong" message with "Try again" button calling `reset()`
  - `app/project/[id]/error.tsx` -- same pattern with "Back to projects" link
  - Uses zinc-900 card style matching app theme
  - Build passes
- **Status:** done

### T4: Add inline error states for fetch failures
- **Size:** M
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; error message shown when API fetch fails (can test by temporarily breaking API URL)
- **Acceptance criteria:**
  - Home page: shows error card with retry button when `/api/projects` fails
  - Project overview: shows error card when project detail fetch fails
  - Backlog page: shows error card when backlog fetch fails
  - History page: shows error card when history fetch fails
  - Backlog detail: shows error card when item fetch fails
  - Live page: already handles connection errors adequately
  - Error state includes: red-tinted card, message, retry button
  - Build passes
- **Status:** done

### T5: Standardize empty states
- **Size:** S
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; empty states render consistently across pages
- **Acceptance criteria:**
  - Create `components/empty-state.tsx` with icon slot, title, subtitle, optional action button
  - Replace ad-hoc empty states on: home (no projects), backlog (no items), history (no entries), live (no session)
  - Consistent visual style: centered, zinc-500 text, subtle icon above
  - Build passes
- **Status:** done

### T6: Responsive layout polish
- **Size:** M
- **Dependencies:** T1
- **Agent:** Dev (generic)
- **Test strategy:** Build succeeds; visual verification at 375px, 768px, 1024px widths
- **Acceptance criteria:**
  - Nav tabs: horizontal scroll with `overflow-x-auto` on small screens, no wrapping
  - Project cards on home: single column on mobile (already `grid-cols-1`)
  - Mission control cards: single column on mobile (already `md:grid-cols-2`)
  - Backlog detail page: metadata grid goes single column on mobile
  - Header elements: stack vertically on narrow screens where needed
  - Dialog/modal widths: max-w responsive (already likely handled by shadcn)
  - Padding reduces on mobile: `px-4 sm:px-6`
  - Build passes
- **Status:** done

### T7: Visual verification with Playwright
- **Size:** M
- **Dependencies:** T1, T2, T3, T4, T5, T6
- **Agent:** QA Lead
- **Test strategy:** Screenshot every page at desktop and mobile widths
- **Acceptance criteria:**
  - Navigate to every page and take screenshots
  - Verify nav highlighting is correct on each page
  - Verify loading states appear during navigation
  - Verify empty states render properly
  - Verify responsive layout at 375px width
  - All screenshots saved and reviewed
- **Status:** skipped (no E2E command configured)
