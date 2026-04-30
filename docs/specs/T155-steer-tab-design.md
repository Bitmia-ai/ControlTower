# T155 — Improve Steer Tab Design

## Overview

Redesign the Steer tab (`app/project/[id]/steer/steer-client.tsx`) to improve visual hierarchy, accessibility, and usability. The Steer tab is where users send steering directives to the RedEye agent team. The current design has seven identified issues that this spec addresses.

## Issues being fixed

1. **Redundant page header** — the inner `<header>` with "Control Tower / Steer" duplicates the project-level header already rendered in `layout.tsx`. Removed.
2. **Flat compose form** — no visual differentiation from the list below. Fixed by elevating into a card with header, icon, and subtle shadow.
3. **Hidden action buttons** — edit/delete buttons used `opacity-0 group-hover:opacity-100`, making them invisible to keyboard-only and touch users. Fixed with always-visible actions column.
4. **Weak section header** — "Current Directives" was plain mono text. Replaced with `<h2>` + live count badge.
5. **No character count** — compose textarea gave no feedback on length. Added `charCount/MAX_DIRECTIVE_CHARS` counter that turns amber near limit, red over limit.
6. **Plain empty state** — generic text only. Replaced with icon + styled dashed-border card.
7. **Icon-free submit button** — added `Send` lucide icon for visual clarity.

## Architecture decisions

### AD-1: steer-client.tsx is the only file changed

All design changes are purely within the client component. No API changes, no new routes, no parser changes. The `EmptyState` component import is removed in favour of an inline empty state that carries the Radio icon for visual coherence.

### AD-2: Always-visible actions via column layout

The directive row switches from a flat flex row with opacity-0 buttons to a three-column layout:
- Left: ordinal gutter (monospace 01/02/03 — "mission briefing" aesthetic)
- Center: content (markdown + date)
- Right: always-visible actions column (edit/delete)

This removes the hover-only accessibility gap. The min-tap-target size (36×36px) meets the 44px composite target when counting column padding.

### AD-3: Compose card header pattern

The compose form uses the same card-with-header pattern used in the SteerDialog (`components/steer-dialog.tsx`) and the Tasks tab. Header contains a `Radio` icon (signals "transmission"), bold label, and an inline code hint for `.redeye/steering.md`.

### AD-4: Character count threshold

`MAX_DIRECTIVE_CHARS = 2000`. Counter visible only when `charCount > 0`. Colour states:
- Gray: 0–79% of limit
- Amber: 80–100% of limit
- Red + semibold: over limit (submit disabled)

### AD-5: Section header uses `<h2>` not `<h3>`

The parent layout renders the project name as `<h1>`. "Active Directives" is now `<h2>` (was incorrectly `<h3>`) for correct heading hierarchy. The live count badge is a `<span>` pill with red-100/red-950 background.

### AD-6: EmptyState inline replacement

The shared `<EmptyState>` component is replaced with an inline empty state that includes a `Radio` icon in a rounded container, matching the compose card's icon treatment. This creates visual coherence between "no directives" and the compose action.

### AD-7: Unused import removed

`EmptyState` from `@/components/empty-state` is no longer imported.

## Sub-task decomposition

### ST-1 — Design implementation in steer-client.tsx (M)

**Files:** `app/project/[id]/steer/steer-client.tsx`

**Work:** Already implemented by the design subagent in PLAN. Changes:
- Remove redundant inner `<header>` block
- Elevate compose form into a card with header section (Radio icon, label, file hint)
- Add character counter with amber/red thresholds
- Add `Send` icon to submit button
- Redesign directive row: ordinal gutter + content + always-visible actions column
- Replace `<EmptyState>` with inline styled empty state
- Replace `<h3>` "Current Directives" with `<h2>` "Active Directives" + live count badge
- Remove `EmptyState` import (no longer used)

**Dependencies:** none

**Status:** done (implemented in PLAN)

---

### ST-2 — Update unit tests for new design (M)

**Files:** `app/project/[id]/steer/page.test.tsx`

**Work:**
- The heading level changed: `getByRole("heading", { name: "Steer", level: 1 })` — this heading was removed. Tests must now assert the `<h2>` "Active Directives" heading instead, or assert that the compose card label "New directive" is present.
- The `EmptyState` "No directives yet." text is still present in the inline replacement — existing `getByText("No directives yet.")` assertions still pass.
- Edit/delete button aria-labels are unchanged (`Edit directive N`, `Delete directive N`) — those tests still pass.
- Add assertions for: character counter appears when text is entered, submit button disabled when over limit, count badge visible when directives are loaded.
- The section header text changed from "Current Directives" to "Active Directives" — if any test asserts this text, update it.

**Test strategy:** Vitest unit tests. Render `<SteerContent id="0" />` with mocked fetch.

**Acceptance criteria:**
- All existing passing tests continue to pass (no regressions).
- New assertions: char counter visible after typing, count badge shows when directives loaded, "Active Directives" heading present.
- `npx vitest run` exits 0 with test count >= 1591 baseline.

**Dependencies:** ST-1

**Status:** done

---

### ST-3 — Browser screenshot validation (S)

**Work:** Per steering directive (`Any UI change needs to be validated in browser via screenshots`), take Playwright / MCP browser screenshots of:
1. Steer tab empty state (no directives).
2. Compose card with text entered (char count visible).
3. Directive list with 1+ directives showing ordinal gutter and always-visible action buttons.
4. Directive row in confirm-delete state.
5. Mobile (375px) — no horizontal overflow.

Verify:
- No layout breakage.
- Action buttons (edit/delete) visible without hover in the screenshot.
- Count badge present in section header when directives exist.
- Dark mode renders correctly.

**Test strategy:** Browser screenshots via Playwright MCP tool against `http://localhost:3200`.

**Acceptance criteria:**
- Screenshots confirm all five views render correctly.
- No horizontal overflow at 375px.
- Action buttons visually present (not opacity-0).

**Dependencies:** ST-1, ST-2

**Status:** pending

---

### ST-4 — E2E spec update (S)

**Files:** `e2e/steer-tab.spec.ts`

**Work:**
- The existing E2E spec asserts `getByRole("heading", { name: "Steer", level: 1 })` — this heading was removed. Update to assert the compose card label `getByLabel("New directive")` and the `<h2>` "Active Directives" heading are present instead.
- Add assertion that the edit and delete buttons are visible (not opacity-0) on load — use `toBeVisible()` on `getByLabel("Edit directive 1")` without a hover prerequisite.

**Test strategy:** Playwright E2E against prod build on `http://localhost:3200`.

**Acceptance criteria:**
- `npm run e2e` passes all steer-tab spec assertions.
- No new flaky selectors introduced.

**Dependencies:** ST-1, ST-3

**Status:** pending

---

### ST-5 — Full regression (S)

**Work:**
- `npx vitest run` — assert count >= 1591 (T137 baseline).
- `npm run typecheck` — exit 0.

**Acceptance criteria:**
- Test count >= 1591.
- typecheck exit 0.
- No pre-existing failures newly broken.

**Dependencies:** ST-1, ST-2, ST-3, ST-4

**Status:** pending

---

## Questions posted to CEO

None. The design direction and all seven issues are clearly specified. No ambiguous product decisions.

## Files touched

| File | Change |
|------|--------|
| `app/project/[id]/steer/steer-client.tsx` | Full redesign (ST-1, done) |
| `app/project/[id]/steer/page.test.tsx` | Update + extend tests (ST-2) |
| `e2e/steer-tab.spec.ts` | Update heading assertion + add visibility assertion (ST-4) |

Estimated new/updated tests: ~5 unit tests (ST-2), ~2 E2E assertions (ST-4).
