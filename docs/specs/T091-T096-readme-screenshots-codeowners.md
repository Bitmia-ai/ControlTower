# T091 + T096: README Screenshots Refresh + CODEOWNERS

## Context

- **T091 (P0):** Refresh three README screenshots after major UI redesigns (T066/T067/T071/T083/T085/T107)
- **T096 (P1):** Add `.github/CODEOWNERS` with `* @Bitmia-ai`

## T091: README Screenshots

### Problem

Screenshots in `.github/assets/` are from before the redesign era:
- `home.png` — from before the precision-instrument redesign (T066)
- `mission-control.png` — from before T067/T083/T085
- `task-detail.png` — missing (README references it but only `backlog-detail.png` exists)

The README at the top shows `home.png` as the hero image. The table shows `mission-control.png` and `task-detail.png`.

### Acceptance Criteria

1. **`home.png`** — refreshed screenshot of `http://localhost:3200` showing the current home page with project cards (precision-instrument design: CONTROL TOWER eyebrow, project cards with status top border, pulsing dot)
2. **`mission-control.png`** — refreshed screenshot of a project mission control page showing the current layout (asymmetric 2-column, WorkingOn hero card, ControlsCard with icons, CostCard, etc.)
3. **`task-detail.png`** — new screenshot of a task detail page (e.g., `/project/1/tasks/T107`) showing the Description field (just shipped in iter 119), Summary, type, priority, status fields
4. Old `backlog-detail.png` can remain (it's not referenced in the current README, just extra)
5. All screenshots at 1200px wide viewport, dark mode
6. README already correctly references `task-detail.png` and `mission-control.png` and `home.png`

### Implementation Steps

1. Use Playwright to navigate to `http://localhost:3200`
2. Set viewport to 1200x900 (dark mode is system default)
3. Capture `home.png` — full page screenshot of home
4. Navigate to project mission control page (e.g., `http://localhost:3200/project/1`)
5. Capture `mission-control.png`
6. Navigate to a task detail page (e.g., `http://localhost:3200/project/1/tasks/T107` or any task with Description)
7. Capture `task-detail.png`
8. Save all to `/Users/casa/ControlTower/.github/assets/`

### Test Considerations

No unit tests needed — this is a docs/assets change. Visual verification via the screenshots themselves. Confirm all 3 files exist and have reasonable file size (> 10KB each).

## T096: CODEOWNERS

### Problem

No `.github/CODEOWNERS` file exists. This means GitHub doesn't auto-request review from `@Bitmia-ai` on PRs.

### Acceptance Criteria

File `.github/CODEOWNERS` created with content:
```
# Default owner for all files
* @Bitmia-ai
```

### Implementation

Create `.github/CODEOWNERS` with the single wildcard rule. No other changes.

## Files to Change

- `.github/assets/home.png` — replace
- `.github/assets/mission-control.png` — replace
- `.github/assets/task-detail.png` — create new
- `.github/CODEOWNERS` — create new

## No Code Changes

Neither task requires any source code changes. No tests to update. Build and test suite unaffected.

## Sub-tasks

| ID | Description | Size |
|----|-------------|------|
| S1 | Capture home.png via Playwright | S |
| S2 | Capture mission-control.png via Playwright | S |
| S3 | Capture task-detail.png via Playwright | S |
| S4 | Create .github/CODEOWNERS | S |

Total: 4 small sub-tasks, all independent.
