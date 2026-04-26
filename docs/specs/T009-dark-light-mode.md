# T009: Support both dark and light mode properly

**Type:** feature
**Priority:** P0
**Status:** in-progress
**Created:** 2026-04-24
**Revised:** 2026-04-24 (iteration 28 — replan after CEO reopen)

## Background

The CEO flagged T009 as NOT DONE. A prior iteration implemented the theme infrastructure
(next-themes, ThemeProvider, ThemeToggle, CSS variables, dark: variants on all components) and the
build is clean with all 166 tests passing. However, the feature was never visually verified with
Playwright screenshots, and one minor light-mode token gap remains in `project-card.tsx`. This
replan scopes the remaining true work:

1. Fix the one remaining bare `bg-zinc-600` indicator dot in `project-card.tsx` (missing light-mode
   equivalent — should be `bg-gray-400 dark:bg-zinc-600`).
2. Write and run a Playwright E2E test that screenshots both light and dark mode across key pages,
   producing visual proof the feature is complete.

## Architecture Decisions

### 1. Theme infrastructure (complete — no changes needed)

- `next-themes@0.4.6` installed; `ThemeProvider` wraps app in `app/layout.tsx` with
  `attribute="class"` and `defaultTheme="system"`
- `suppressHydrationWarning` on `<html>` prevents SSR/CSR mismatch
- `globals.css` defines CSS variables under `:root` (light) and `.dark` (dark)
- `ThemeToggle` component cycles System → Light → Dark using lucide-react Sun/Moon/Monitor icons
- All mission-control cards, dialogs, page-level components, and nav use proper `bg-X dark:bg-Y`
  pairs throughout

### 2. Remaining token fix

`components/project-card.tsx` line 70: the "initialized" indicator dot uses bare `bg-zinc-600`
(dark-only). In light mode this renders a dark dot on a white card — visually acceptable but
inconsistent with the palette. Fix: `bg-gray-400 dark:bg-zinc-600`.

### 3. Playwright visual verification

The E2E test file at `e2e/dark-light-mode.spec.ts` was created (skeleton) but marked
`test.describe.skip` due to no Playwright config. The BUILD task will:
- Add a minimal `playwright.config.ts` at the repo root (targeting `http://localhost:3200`, single
  chromium project)
- Implement the test with `colorScheme: 'light'` and `colorScheme: 'dark'` contexts
- Take screenshots for: home page, mission control, backlog, history, live tab (both modes)
- Save to `screenshots/` with descriptive names
- Verify no obvious contrast failures by screenshot review

### 4. Light-mode palette (reference)

| Token        | Light value            | Dark value               |
|-------------|------------------------|--------------------------|
| bg-base      | gray-50 / #f9fafb      | zinc-950 / #09090b       |
| bg-surface   | white / #ffffff         | zinc-900 / #18181b       |
| bg-elevated  | white / #ffffff         | zinc-800 / #27272a       |
| border       | gray-200 / #e5e7eb     | zinc-800 / #27272a       |
| text-primary | gray-900 / #111827     | zinc-100 / #f4f4f5       |
| text-secondary | gray-600 / #4b5563   | zinc-400 / #a1a1aa       |
| text-muted   | gray-400 / #9ca3af     | zinc-500 / #71717a       |
| accent       | red-600 / #DC2626       | red-600 / #DC2626        |

## Sub-task Decomposition

### T1 — Fix bare bg-zinc-600 in project-card.tsx [S]

**Agent:** Dev (generic)
**Dependencies:** none
**Files:** `components/project-card.tsx`
**Test strategy:** Existing unit tests cover rendering; visual confirmed by T2 screenshots
**Acceptance criteria:**
- Line 70: `project.initialized ? "bg-green-500" : "bg-zinc-600"` → `"bg-gray-400 dark:bg-zinc-600"`
- Build passes, existing 166 tests still pass
**Status:** done

### T2 — Add Playwright config and implement dark/light mode E2E screenshots [M]

**Agent:** QA Lead
**Dependencies:** T1
**Files:**
- `playwright.config.ts` (new)
- `e2e/dark-light-mode.spec.ts` (rewrite — remove skip, implement fully)
**Test strategy:** Playwright runs against `http://localhost:3200` in two contexts: forced light and
forced dark. Screenshots are saved and reviewed for visual correctness.
**Acceptance criteria:**
- `playwright.config.ts` exists with baseURL `http://localhost:3200`, chromium only, no retries
- `e2e/dark-light-mode.spec.ts` has two `test.describe` blocks: "Light mode" and "Dark mode"
- Each block screenshots: `/` (home), `/project/0` (mission control), `/project/0/backlog`,
  `/project/0/history`, `/project/0/live`
- Screenshots saved to `screenshots/theme-light-{page}.png` and `screenshots/theme-dark-{page}.png`
- Test runner exits 0 when app is running (no assertion failures on screenshot existence)
- Screenshots visually confirm: light mode shows white/gray backgrounds with dark text; dark mode
  shows zinc-900/zinc-950 backgrounds with light text
**Status:** done

### T3 — Verify build + full test suite clean [S]

**Agent:** Dev (generic)
**Dependencies:** T1, T2
**Test strategy:** `npm run build` and `npx vitest run`
**Acceptance criteria:**
- `npm run build` exits 0 with no TypeScript errors
- All 166+ vitest tests pass
- No new console errors or warnings introduced
**Status:** done

## Questions

### Q-002: Theme toggle style preference (answered)
- **Answer:** Icon cycle button — Sun/Moon/Monitor from lucide-react cycling Light → Dark → System
- **Implemented:** Yes

## Test Strategy Summary

- Unit: 166 existing tests cover ThemeToggle, FetchError, ProjectNav, BacklogId — all passing
- E2E Playwright: T2 adds screenshot tests in forced light and dark colorScheme
- Build: TypeScript compile check on every PR via `npm run build`
- Manual: Toggle through Light / Dark / System and verify OS preference is respected

## Acceptance Criteria (Feature-level)

1. The app renders correctly in both light mode and dark mode
2. A header toggle cycles Light, Dark, System with Sun/Moon/Monitor icons
3. "System" respects the OS `prefers-color-scheme` via next-themes
4. The chosen theme persists across page reloads (via localStorage)
5. No white-on-white or dark-on-dark text anywhere (visually confirmed by Playwright screenshots)
6. Red accent (#DC2626) remains unchanged in both themes
7. Playwright screenshots in `screenshots/` document both modes passing
8. `npm run build` clean, all vitest tests green
