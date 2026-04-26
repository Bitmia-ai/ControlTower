# T001: Smoke Test All Pages Using Playwright Browser

**Type:** test
**Priority:** P0
**Status:** done

## Overview

Comprehensive smoke test of every page in the Control Tower dashboard using Playwright MCP browser tools. Navigate to each route at http://localhost:3200, verify content renders correctly, take screenshots, and log any discovered bugs as new backlog items.

## Architecture Context

The app is a Next.js application with the following route structure:

- `/` -- Home page with project cards
- `/project/[id]` -- Mission Control (default project page)
- `/project/[id]/backlog` -- Backlog tab listing BL-xxx items
- `/project/[id]/backlog/[taskId]` -- Individual backlog item detail
- `/project/[id]/history` -- Iteration history tab
- `/project/[id]/live` -- Live session output tab

Key dialogs:
- Add Project dialog (components/add-project-dialog.tsx)
- Steer dialog (components/steer-dialog.tsx)
- Add Backlog dialog (components/add-backlog-dialog.tsx)

Test project: **haze** (index 0 in the project list).

## Constraints

- Use Playwright MCP browser tools exclusively (navigate, snapshot, click, screenshot)
- Do NOT start/stop actual RedEye sessions -- just verify UI renders
- Fix bugs directly in the codebase, run `npm run build` after changes
- Take screenshots to verify visual state of each page

## Sub-Tasks

### T1: Home Page -- Verify Project Cards Render
- **Size:** S
- **Dependencies:** none
- **Agent:** QA Lead
- **Test Strategy:**
  1. Navigate to http://localhost:3200
  2. Take a browser snapshot, verify project cards are present
  3. Verify the haze project card is visible with correct status info
  4. Take screenshot: `screenshots/T1-home-page.png`
- **Acceptance Criteria:**
  - Home page loads without errors
  - At least one project card (haze) is visible
  - Project card shows name, status, and health indicators
- **Status:** done

### T2: Mission Control -- Click Into Haze Project
- **Size:** S
- **Dependencies:** T1
- **Agent:** QA Lead
- **Test Strategy:**
  1. From home page, click on the haze project card
  2. Verify navigation to `/project/{id}` (Mission Control)
  3. Take snapshot, verify mission control cards render (Working On, Health, Phase, etc.)
  4. Take screenshot: `screenshots/T2-mission-control.png`
- **Acceptance Criteria:**
  - Clicking haze project navigates to mission control
  - Mission control cards (Working On, Health, Phase) are visible
  - Nav tabs (Backlog, History, Live) are present
- **Status:** done

### T3: Backlog Tab -- Verify Items and Detail Pages
- **Size:** M
- **Dependencies:** T2
- **Agent:** QA Lead
- **Test Strategy:**
  1. Click the Backlog tab
  2. Verify backlog items (T001, T002, etc.) render in a list
  3. Take screenshot: `screenshots/T3-backlog-list.png`
  4. Click on a BL-xxx link (e.g., T001)
  5. Verify detail page opens at `/project/{id}/backlog/{taskId}`
  6. Take screenshot: `screenshots/T3-backlog-detail.png`
- **Acceptance Criteria:**
  - Backlog tab shows list of backlog items with IDs, titles, and statuses
  - Clicking a BL-xxx item navigates to its detail page
  - Detail page shows full item information
- **Status:** done

### T4: History Tab -- Verify Iteration History
- **Size:** S
- **Dependencies:** T2
- **Agent:** QA Lead
- **Test Strategy:**
  1. Click the History tab
  2. Verify iteration history entries render (or appropriate empty state)
  3. Take screenshot: `screenshots/T4-history.png`
- **Acceptance Criteria:**
  - History tab loads without errors
  - Shows iteration entries or empty state message
- **Status:** done

### T5: Live Tab -- Verify Empty State
- **Size:** S
- **Dependencies:** T2
- **Agent:** QA Lead
- **Test Strategy:**
  1. Click the Live tab
  2. Verify empty state message renders (fixed in T002)
  3. Take screenshot: `screenshots/T5-live-empty.png`
- **Acceptance Criteria:**
  - Live tab shows "No active session" empty state
  - No blank/broken page
- **Status:** done

### T6: Dialogs -- Test Open/Close
- **Size:** M
- **Dependencies:** T2
- **Agent:** QA Lead
- **Test Strategy:**
  1. Navigate back to home page
  2. Open Add Project dialog, verify form fields render, close it
  3. Take screenshot: `screenshots/T6-add-project-dialog.png`
  4. Navigate into haze project
  5. Open Steer dialog, verify textarea renders, close it
  6. Take screenshot: `screenshots/T6-steer-dialog.png`
  7. Open Add Backlog dialog, verify form fields render, close it
  8. Take screenshot: `screenshots/T6-add-backlog-dialog.png`
- **Acceptance Criteria:**
  - All three dialogs open and close without errors
  - Dialog forms show expected input fields
  - Closing dialog returns to previous view
- **Status:** done

### T7: Bug Logging -- Log Discovered Bugs
- **Size:** S
- **Dependencies:** T1-T6
- **Agent:** QA Lead
- **Test Strategy:**
  1. After completing T1-T6, compile list of any bugs discovered
  2. Add each bug as a new item in `.redeye/backlog.md` under `## Discovered` with status `pending-triage`
  3. Include reproduction steps and screenshot references
- **Acceptance Criteria:**
  - All discovered bugs are logged with clear descriptions
  - Each bug has reproduction steps
  - Screenshots referenced where applicable
- **Status:** done

## Summary

- **Total sub-tasks:** 7
- **Sizes:** 5x S, 2x M
- **Estimated effort:** Small -- mostly navigation and verification
- **Sequential flow:** T1 -> T2 -> T3/T4/T5 (parallel from T2) -> T6 -> T7
