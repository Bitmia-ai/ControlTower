# BL-024 — Add aria-labels to all interactive buttons and controls

**Status:** planned  
**Priority:** P2  
**Spec author:** VP Engineering (iteration 59)

---

## Audit Results

Full scan of all interactive elements across the dashboard. Elements already correctly labelled are noted for completeness.

### Audit Table

| # | File | Line(s) | Element | Current state | Proposed fix |
|---|------|---------|---------|--------------|-------------|
| 1 | `components/transcript-viewer.tsx` | 67–75 | `ToolUseCard` toggle button | Has visible text ("tool_name · tool call") but no `aria-label` describing expand/collapse action; screen reader reads raw chars `▼`/`▶` | Add `aria-label` (dynamic): `aria-label={open ? "Collapse tool call" : "Expand tool call"}`; add `aria-expanded={open}` |
| 2 | `components/transcript-viewer.tsx` | 101–112 | `ToolResultCard` toggle button | Same issue — `▼`/`▶` glyphs, no expand/collapse label | `aria-label={open ? \`Collapse ${label} result\` : \`Expand ${label} result\`}`; `aria-expanded={open}` |
| 3 | `components/transcript-viewer.tsx` | 136–148 | `ThinkingCard` toggle button | Same issue — `▼`/`▶` glyphs, no expand/collapse label | `aria-label={open ? "Collapse thinking" : "Expand thinking"}`; `aria-expanded={open}` |
| 4 | `components/project-card.tsx` | 75–81 | `Trash2` icon-only delete button | Has `title="Remove project"` but no `aria-label`; title is not reliably announced by all screen readers | `aria-label={\`Remove ${project.name}\`}` |
| 5 | `components/add-backlog-dialog.tsx` | 73–81 | Title text input ("What needs to be done?") | Has placeholder only; no `<label>` linked via `htmlFor`/`id`, no `aria-label` | Add `id="backlog-title"` to input; add `htmlFor="backlog-title"` to implicit label (or add `aria-label="Task title"`) |
| 6 | `components/add-backlog-dialog.tsx` | 94–100 | Description textarea | Has placeholder only; no label | Add `id="backlog-description"` + explicit `<label htmlFor="backlog-description">Description</label>` (visually hidden), or `aria-label="Task description"` |
| 7 | `components/add-backlog-dialog.tsx` | 101–116 | Priority `<select>` | Has adjacent `<label>` text but label element has no `htmlFor` and input has no `id` | Add `id="backlog-priority"` to select; add `htmlFor="backlog-priority"` to the label |
| 8 | `components/steer-dialog.tsx` | 62–69 | Directive textarea | Has placeholder only; no label or aria-label | Add `aria-label="Steering directive"` to textarea |
| 9 | `components/answer-modal.tsx` | 93–99 | Answer textarea | Has placeholder only; no label or aria-label | Add `aria-label="Your answer"` to textarea |
| 10 | `components/add-project-dialog.tsx` | 71–82 | Name input | Has adjacent `<label>` text but no `htmlFor`/`id` linkage | Add `id="project-name"` to input; add `htmlFor="project-name"` to label |
| 11 | `components/add-project-dialog.tsx` | 84–95 | Path input | Same — label not linked | Add `id="project-path"` to input; add `htmlFor="project-path"` to label |
| 12 | `components/onboarding-wizard.tsx` | 180–188 | Vision textarea | Has `<label>` with text but no `htmlFor`/`id` | Add `id="wizard-vision"` + `htmlFor="wizard-vision"` |
| 13 | `components/onboarding-wizard.tsx` | 201–209 | Tasks text input | Has no visible label; placeholder only | Add `aria-label="New task"` |
| 14 | `components/onboarding-wizard.tsx` | 261–270 | Deploy command input | Has adjacent `<label>` text but no `htmlFor`/`id` | Add `id="wizard-deploy"` + `htmlFor="wizard-deploy"` |
| 15 | `components/onboarding-wizard.tsx` | 273–283 | Test command input | Same | Add `id="wizard-test"` + `htmlFor="wizard-test"` |
| 16 | `components/onboarding-wizard.tsx` | 285–296 | App URL input | Same | Add `id="wizard-url"` + `htmlFor="wizard-url"` |
| 17 | `components/onboarding-wizard.tsx` | 323, 343, 367 | "Edit" buttons in Review step | Text label "Edit" with no context — screen reader announces "Edit" three times with no indication which section | Add `aria-label="Edit vision"`, `aria-label="Edit initial tasks"`, `aria-label="Edit commands"` respectively |

**Total: 17 elements need fixes across 5 files.**

### Elements already correctly labelled (no change needed)

| File | Element | Why it's OK |
|------|---------|------------|
| `controls-card.tsx` | ChevronDown dropdown caret | `aria-label="More stop options"`, `aria-haspopup`, `aria-expanded` present |
| `controls-card.tsx` | Add to Backlog button | `aria-label="Add item to backlog"` present |
| `controls-card.tsx` | Start/Stop/Pause/Restart/Steer buttons | All have clear visible text labels |
| `transcript-viewer.tsx` | All `<ChevronDown>` icons inside CollapsibleSection | N/A — the collapsible-section wrapper already handles labeling |
| `theme-toggle.tsx` | Theme cycle button | Dynamic `aria-label` with current theme state present |
| `collapsible-section.tsx` | Expand/Collapse toggle | `aria-label` and `aria-expanded` already present |
| `onboarding-wizard.tsx` | "Remove task" × button | `aria-label="Remove task"` already present |
| `questions-card.tsx` | Answer button | Has visible "Answer" text |
| `live/page.tsx` | Auto-scroll, Expand all, Collapse all, Clear, Reconnect | All have visible text labels |
| `add-backlog-dialog.tsx` | Add details toggle button | Has visible text "Add details"/"Hide details" |
| `project-card.tsx` | Start/Stop toggle | Has visible "Start"/"Stop"/"Stopping…" text |
| `answer-modal.tsx` | Option choice buttons | Each button renders the option text |

---

## Architecture Decisions

**AD-1: Inline `aria-label` attributes only.**  
All fixes are inline `aria-label` / `htmlFor` / `id` attribute additions directly in the existing JSX. No new wrapper components, no new files. Keeps the diff minimal and reviewable.

**AD-2: Dynamic aria-labels for collapsible cards.**  
`ToolUseCard`, `ToolResultCard`, `ThinkingCard` have open/closed states. The `aria-label` must reflect the current state ("Expand…" vs "Collapse…") for screen reader users to understand the current action available. Add `aria-expanded` alongside the dynamic label.

**AD-3: Form inputs — prefer `htmlFor`/`id` linkage over `aria-label` where a visible label already exists.**  
Where a `<label>` element is already rendered but unlinked (add-project-dialog, onboarding-wizard), the fix is to link them with `htmlFor`/`id`. This is semantically correct and keeps the visible label in sync. Where no visible label exists (steer-dialog, answer-modal), use `aria-label` on the control.

**AD-4: No changes to styling, behavior, or test IDs.**  
This is a pure accessibility pass. No functional changes to handlers, state, or visual rendering.

**AD-5: `aria-label` on the `Trash2` icon button includes the project name.**  
Generic "Remove project" is ambiguous when multiple cards appear. `aria-label={\`Remove ${project.name}\`}` is specific and actionable.

---

## Sub-task Decomposition

### T1 — Apply all aria-labels (BUILD)

**Size:** S  
**Assigned agent:** Dev (generic)  
**Dependencies:** none  
**Files changed:**
- `components/transcript-viewer.tsx` — fix items 1, 2, 3
- `components/project-card.tsx` — fix item 4
- `components/add-backlog-dialog.tsx` — fix items 5, 6, 7
- `components/steer-dialog.tsx` — fix item 8
- `components/answer-modal.tsx` — fix item 9
- `components/add-project-dialog.tsx` — fix items 10, 11
- `components/onboarding-wizard.tsx` — fix items 12, 13, 14, 15, 16, 17

**Test strategy:**  
- Run `npx vitest run` after changes — existing tests must remain green
- Visual spot-check: verify no UI layout changes

**Acceptance criteria:**
- All 17 items from the audit table have been addressed
- No new TS or lint errors
- `npx vitest run` passes (420+ tests green)

**Status:** done

---

### T2 — Unit tests asserting key aria-labels (BUILD)

**Size:** S  
**Assigned agent:** Dev (generic)  
**Dependencies:** T1  
**Files changed / created:**
- `components/transcript-viewer.test.tsx` — extend existing test file with assertions for `aria-label` and `aria-expanded` on ToolUseCard, ToolResultCard, ThinkingCard toggle buttons
- `components/project-card.test.tsx` — extend existing test file with assertion that Trash2 button has `aria-label` containing the project name
- New test cases in dialog test files (or a new `components/__tests__/dialogs.test.tsx`) asserting:
  - `add-project-dialog`: Name and Path inputs have linked labels (`htmlFor`/`id`)
  - `add-backlog-dialog`: Priority select has linked label
  - `steer-dialog`: textarea has `aria-label="Steering directive"`
  - `answer-modal`: textarea has `aria-label="Your answer"`
  - Onboarding wizard "Edit" buttons have distinct `aria-label` values

**Test strategy:**  
- Use `@testing-library/react` `getByRole` and `getByLabelText` — these assertions pass only when labels are correctly associated
- Target ~12 new test cases across 3–4 test files

**Acceptance criteria:**
- All new tests pass
- `npx vitest run` remains fully green (420+ total)
- No test uses raw `aria-label` string selectors that would survive a missing label (use `getByLabelText` or `getByRole(..., { name: ... })`)

**Status:** pending

---

## Acceptance Criteria (feature-level)

1. Every icon-only interactive button has an `aria-label` (or equivalent) that describes the action, not just the icon name.
2. Every form input / textarea / select has an associated label — either via `htmlFor`/`id` linkage to a visible `<label>` element, or via `aria-label` when no visible label exists.
3. All collapsible card toggle buttons expose `aria-expanded` reflecting their open/closed state.
4. Audit table items 1–17 are resolved.
5. Unit tests (T2) cover the highest-risk items: transcript card toggles, delete button, and dialog inputs.
6. Build passes: `NODE_ENV=production npm run build` exits 0.
7. Tests pass: `npx vitest run` all green.

---

## Questions Posted to CEO

None. This is a self-contained accessibility hygiene pass with no architectural ambiguity.
