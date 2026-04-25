# Backlog

## CEO Requests

### BL-053: Improve session history page — show phase timeline and cost per session
- **Type:** feature
- **Priority:** P2
- **Status:** planned
- **Added:** 2026-04-25 (iter 79)
- **Details:**
  - The history page at /project/[id]/history shows a flat session list with start/end times
  - Enrich each session row with: total cost for that session, number of phases completed, and a mini phase timeline (PLAN → BUILD → REVIEW → DEPLOY chips)
  - Parse session cost from the corresponding JSONL transcript file
  - Show a "phases completed" count badge and an expandable phase list on each row
  - Should use existing cost-calculator.ts and transcript-file-resolver.ts

### BL-052: Add keyboard shortcuts for common actions (Start, Stop, Backlog navigation)
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 82)
- **Added:** 2026-04-25 (iter 79)
- **Summary:** Added keyboard shortcuts to the project page — S to start, X to stop, P to pause, B to add to backlog, and G+B/G+H/G+L to navigate tabs. Small keyboard hint badges appear on each button and are suppressed when a dialog is open or a text input is focused. Thirty-one new unit tests and one E2E spec cover the feature.
- **Details:**
  - Power users have no keyboard shortcuts for frequent actions
  - Add: `S` to Start session (when idle), `X` to gracefully Stop (when running), `B` to navigate to Backlog, `H` to navigate to History, `L` to navigate to Live tab
  - Show keyboard hint labels on buttons (small secondary text like "⌘S")
  - Implement via a global keydown listener in a client component; disable shortcuts when a modal/dialog is open or a text input is focused
  - Add unit tests for the shortcut hook

### BL-051: Cost analytics — add cumulative cost chart to mission control
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 81)
- **Added:** 2026-04-25 (iter 79)
- **Spec:** docs/specs/BL-051-cost-analytics-sparkline.md
- **Summary:** Added a cumulative cost sparkline to the mission control Cost card. Each bar represents one session's cost over the last ten sessions, implemented as a pure SVG component with no new dependencies. The sparkline respects dark and light mode and is hidden when no session history exists.
- **Planning:** Pure SVG sparkline (no new deps). New `lib/cost-history.ts`, `GET /api/projects/[id]/cost-history`, `SparklineChart` component, and `CostCard` extension. 6 sub-tasks (4S+1M+1S). No CEO questions needed.
- **Details:**
  - The cost card shows current session + total as numbers, but no trend data
  - Add a simple bar or line sparkline chart showing cost per session over the last 10 sessions
  - Use recharts (already in many Next.js stacks) or a lightweight SVG chart — check if recharts is already in package.json; if not, implement as a pure SVG component to avoid adding a dependency
  - Chart should be responsive and respect dark/light mode
  - Data source: parse each JSONL transcript file for cost_usd sum per file (one file = one session)

### BL-050: Add in-app notification toast when RedEye phase changes (BUILD, REVIEW, DEPLOY, DONE)
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 80)
- **Added:** 2026-04-25 (iter 79)
- **Details:**
  - Users have no awareness of phase changes without watching the dashboard constantly
  - When the mission control 5s poll detects a phase change, show a toast notification (e.g. "RedEye entered BUILD phase — working on BL-049")
  - Use the browser Notification API with permission request on first interaction; fall back to an in-app toast overlay if permission denied
  - Toast should auto-dismiss after 5 seconds; clicking it navigates to the Live tab
  - Add unit tests for the notification hook (mock Notification API)
- **Summary:** Phase-change toast notifications are now shown in the mission control page whenever RedEye enters BUILD, REVIEW, DEPLOY, VERIFY, or DONE. A ToastProvider and ToastContainer were wired into the root layout, with an auto-dismissing overlay and a browser Notification API fallback. Thirty new unit tests and four Playwright E2E tests verify the feature end-to-end.

### BL-049: Expand E2E test coverage — Playwright specs for backlog CRUD, start/stop flow, and cost card
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 79)
- **Added:** 2026-04-25 (iter 79)
- **Spec:** docs/specs/BL-049-e2e-test-coverage.md
- **Details:**
  - Current Playwright coverage is limited to smoke tests and the logo mark
  - Add three new E2E specs:
    1. Backlog CRUD: add a task via dialog, verify it appears in list, navigate to detail, verify fields render
    2. Start/Stop flow: click Start, verify button state changes to "Stop" and working-on card updates; click Stop, verify return to idle
    3. Cost card: verify cost card renders, values are non-negative, session cost <= total cost invariant holds in the DOM
  - Each spec should run against http://localhost:3200 with an existing initialized project
- **Summary:** Added two new Playwright E2E specs: backlog-crud.spec.ts exercises the full add-via-dialog flow through to the detail page, and cost-card.spec.ts verifies the session/total cost non-negative invariant and exact value formatting. Both specs use route interception to avoid external dependencies.

### BL-048: In the live tab, User boxes need to be collapsible and collapsed by default In the live tab, User boxes need to be collapsible and collapsed by default
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 57)
- **Summary:** User message boxes in the Live tab transcript are now collapsible and collapsed by default, reducing visual noise. A sticky Collapse All / Expand All toolbar was added to let users toggle all boxes at once without losing their scroll position.

### BL-047: Update dashboard logo
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 63)
- **Spec:** docs/specs/BL-047-logo.md
- **Planning:** Split-weight "Control Tower" text mark (CONTROL small / TOWER large, both red-600/red-500) replacing flat single-span in app/layout.tsx; linked to /. 3 sub-tasks (all S): T1 implement mark, T2 remove unused public SVGs, T3 unit tests. No image assets needed.
- **Summary:** Replaced the flat single-line header text with a split-weight two-span logo mark — "CONTROL" in small bold tracking-widest and "TOWER" in large black weight, both in red-600/red-500 with dark mode variant, wrapped in a Link to /. Five unused default Next.js scaffold SVGs were removed from public/. Five unit tests and three Playwright E2E tests confirm the link, text content, and navigation behaviour.

### BL-046: Per task cost (est) not autoamtically recorded at the end of each task. it should be the value at the end of the task minus the value at the begining
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/BL-046-auto-cost-recording.md
- **Planning:** Spec written iter 55. Delta detection via mission control 5s polling loop; new cost-start endpoint captures session baseline; cost-snapshot updated to compute end-minus-start. 6 sub-tasks (4S + 1M + 1S), ~13 new unit tests.
- **Summary:** Per-task cost is now recorded automatically as an end-minus-start delta. When the mission control page detects a task transition via its 5-second poll, it fires a cost-start POST at task activation and a cost-snapshot POST at completion; the snapshot endpoint computes the delta and stores only the cost attributable to that task. Older items without a start record continue to fall back to the manual "Record now" button.

### BL-045: can we use the designer sub agent and frontend skill to improve the design of the main project screen?
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 61)
- **Summary:** Redesigned the mission control project page to a 3-column grid with Controls promoted into the first row alongside the wide WorkingOn card, removing decorative borders and section dividers for a cleaner layout. The active task title is now displayed at text-base size with a compact running pill badge shown inline beneath the project name in the header.

### BL-044: In the main screen for a project, i dont like the text +Backlog in the button. can we improve the button? use the designer and frontend skills
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 58)
- **Summary:** Replaced the minimal "+Backlog" label with an "Add to Backlog" button featuring a PlusCircle icon and indigo accent styling, making the action clearer and visually distinct in both light and dark mode. A unit test was added to verify the button's accessible name and click handler.

### BL-043: force stop redeye should be part of a dropdown of the stop button. not a bigger button. the stop button has a dropdown with force stop
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/BL-043-force-stop-dropdown.md
- **Summary:** Replaced the standalone Force Stop button with a split-button pattern on the Stop button: a chevron caret opens a dropdown containing Force Stop, with a two-click inline confirmation and 4-second auto-dismiss replacing the previous Shift+click gesture. The Controls card is now more compact and the power action remains discoverable.

### BL-042: in the backlog detail view, cost (est) shows as Not recorded. fix it
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/BL-042-backlog-detail-cost.md
- **Summary:** Fixed the backlog detail cost row to correctly surface cost data from the cost-snapshot API, distinguishing between items with a genuine zero cost and items where no snapshot was ever recorded. Added a "Record now" button for done items missing a snapshot, and expanded the test suite with 15 new cases covering all display states.

### BL-041: IN the backlog, done tasks should be in a separate section so they don't clutter the ui. use the design subagent and frontend skill to re-design this page
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 54)
- **Spec:** docs/specs/BL-041-backlog-done-section.md
- **Summary:** Redesigned the backlog page to separate done tasks into a collapsible "Done" section below the active/planned items. Done tasks are hidden by default and toggled with a chevron button showing the count, reducing visual clutter while keeping completed work accessible.

### BL-040: In the live tab I still don't see Claude's inter round status messages or thoughts. just tool uses
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/BL-040-live-tab-messages.md
- **Planning:** Root cause is in TranscriptViewer rendering, not normalizer or SSE. Thinking blocks render as invisible bare italic text; text messages lack visual identity. Fix: ThinkingCard (collapsible violet card), AssistantTextCard (red left-border + "Claude" label), suppress plain user messages. 5 sub-tasks (4S + 1S E2E), 1 new test file.
- **Summary:** The Live tab now shows Claude's inter-round text messages and internal thoughts alongside tool uses. Thinking blocks appear as collapsible violet cards labeled "Claude's Thinking", assistant text messages appear with a red left border and "Claude" label, and plain user prompt messages are suppressed to reduce noise.

### BL-039: When RedEye stops due to empty backlog, show a clear message in the UI: "RedEye stopped — backlog empty. Add tasks to resume." instead of just showing Idle.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Summary:** Added a "Backlog empty" state to the WorkingOn card and home page phase badge so that when RedEye stops due to an empty backlog, the UI displays a clear actionable message instead of the generic Idle label. Unit tests cover the new state.

### BL-038: BL-027 cost visibility bug — detail-page cost field not rendering despite code present; verify data flow in item_costs population.
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 49)
- **Source:** Q-005 adjustment (iter 48) — CEO reports cost field invisible in UI
- **Context:** BL-020 T7 shipped cost-per-item infrastructure and code to display `Cost (est.)` on backlog detail page (lines 273–278 in `app/project/[id]/backlog/[taskId]/page.tsx`). However, CEO verified with Playwright that the field is not visible. Suspect issue: `item_costs` in state.json not being populated for completed items, or enrichment logic failing in the GET route.
- **Summary:** Fixed: the cost row (`Cost (est.)`) now always renders for done items in the backlog detail page. Pre-fix, the row was gated behind a condition that could suppress it; post-fix it renders unconditionally for `status === "done"`, showing `$X.XX` when cost_usd is recorded or "Not recorded" for items predating BL-020. Cost snapshot for BL-038 recorded at VERIFY time ($44.71). Steering directive to POST cost-snapshot at every future VERIFY was executed and cleared.

### BL-037: Add Force Stop button (hard kill) for unresponsive sessions — complements graceful stop.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 50)
- **Source:** Q-004 adjustment (iter 48) — CEO wants Force Stop in addition to graceful Stop
- **Context:** BL-034/035/036 shipped graceful Stop/Pause (writes STOP/PAUSE directive to steering.md; CTO exits at next phase boundary). CEO requests a complementary Force Stop button for stalled/unresponsive sessions. This button should hard-kill the subprocess without waiting for graceful shutdown.
- **Acceptance criteria:**
  - Add "Force Stop" button (or icon variant) alongside graceful Stop in mission control and home page project cards
  - Force Stop: SIGKILL the active claude child process via session-manager
  - UI shows "Force stopping…" state; graceful button is disabled while force stop is in progress
  - No backlog item state change (leave as-is until next TRIAGE)
  - Test: start session, trigger Force Stop, verify process exits immediately and UI returns to idle

### BL-036: Stop button not working from home page project cards either — same bug as BL-034 but affects the main screen, not just mission control.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/BL-034-stop-pause-fix.md

### BL-035: Pause button does not work — clicking Pause in browser has no effect on the running session.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/BL-034-stop-pause-fix.md

### BL-034: Stop button does not work — clicking Stop in browser has no effect on the running session.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/BL-034-stop-pause-fix.md

### BL-032: Live tab auto-scroll UX fix — when auto-scroll is on, user cannot scroll up because it snaps back. Auto-scroll should pause when user scrolls up and resume when they scroll back to bottom.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 45)
- **Spec:** docs/specs/BL-032-autoscroll.md

### BL-031: Live tab transcript viewer — fold tool/terminal output by default, only show Claude inter-round messages and thoughts unfolded. Should look like a readable session log, not raw JSONL dump.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 43)
- **Spec:** docs/specs/BL-031-live-tab-fold-tools.md

### BL-030: Fix Live tab — BL-013 was marked done but Live tab still shows nothing. EventSource doesn't receive data despite transcript files existing. Must verify with Playwright before closing.
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Reason:** Superseded by BL-013 (reopened and completed iteration 42). Live tab now tails Claude transcripts with Playwright verification (screenshots: bl013-verify-iter42-live-tab.png, deploy-smoke-live-tab.png). Closed as duplicate at TRIAGE iter 43.

### BL-001: Smoke test all pages using Playwright browser
- **Type:** test
- **Priority:** P0
- **Status:** done
- **Details:**
  - Open http://localhost:3200 in Playwright browser
  - Verify home page loads with project cards
  - Click into haze project, verify mission control cards render
  - Navigate to Backlog, History, Live tabs — verify each works
  - Click BL-xxx links, verify detail pages open
  - Test Add Project, Steer, Add Backlog dialogs
  - Screenshot each page

### BL-002: Fix Live tab showing nothing
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Details:**
  - Live tab at /project/{id}/live shows blank when no active session
  - Add empty state: "No active session. Start RedEye to see live output."
  - When session IS running, verify SSE stream connects and renders events

### BL-003: Test Start/Stop flow end-to-end
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - Click Start on haze, verify button changes to Stop
  - Verify Working On card updates
  - Click Stop, verify session stops and UI returns to idle

### BL-004: Polish UI consistency
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Details:**
  - Loading states on every page
  - Error states with user-friendly messages
  - Empty states with appropriate messaging
  - Nav tabs highlight correctly on each page
  - Responsive layout on narrower viewports

### BL-005: Verify onboarding wizard end-to-end
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - Create fresh test project, add via Add Project
  - Verify wizard starts, fill in fields, initialize
  - Verify redirect to mission control

### BL-009: Support both dark and light mode properly
- **Type:** feature
- **Priority:** P0
- **Status:** done
- **Spec:** docs/specs/BL-009-dark-light-mode.md
- **CEO Note:** NOT DONE. Components have dark: variants but the theme toggle was never wired. The html element has no dark class, no theme provider, no toggle in the header. Light mode still looks broken. Reopen and finish: add next-themes or a manual theme provider, wire the toggle, default to system preference.
- **Details:**
  - The dashboard currently only looks good in dark mode — light mode is broken (wrong backgrounds, invisible text)
  - Design and implement a proper light mode theme alongside the existing dark mode
  - Use Tailwind's dark: variant — dark mode uses current zinc-950 palette, light mode uses clean whites/grays
  - Keep red (#DC2626) as accent in both modes
  - Follow the user's OS preference via prefers-color-scheme
  - Add a toggle in the header to switch between light/dark/system
  - Update globals.css with proper CSS variables for both themes
  - Update ALL components to use dark: variants where needed
  - Test both modes with Playwright screenshots

### BL-010: Detect and recover from stalled sessions (quota exhaustion, permission prompts)
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/BL-010-stall-detection.md
- **Details:**
  - When claude --print hits a quota wall, it shows an interactive menu that can't be answered in headless mode. The process hangs indefinitely.
  - In session-manager.ts: add a health check that monitors the .jsonl log file. If no new output for 10 minutes but the process is still alive, kill and restart it.
  - In the UI: show a warning on the mission control page when a session is stalled ("Session stalled — no output for 10 minutes") with a Restart button.
  - Add a `lastActivity` timestamp to SessionInfo derived from the log file's mtime.
  - The controls card should show "Stalled" state with amber border when detected.

### BL-011: Enforce BL-xxx ID counter at write level — prevent duplicate IDs
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Spec:** docs/specs/BL-011-enforce-bl-id-counter.md
- **Details:**
  - Multiple entry points can add backlog items: /redeye:backlog command, dashboard API, manual edits, HARDEN-discovered items
  - The BL counter in state.json can get out of sync if any entry point skips incrementing it
  - Fix: in the PATCH and POST backlog API routes, always read the current max BL-xxx from backlog.md and ensure new items get the next available ID
  - Add a utility function `getNextBacklogId(projectPath)` that reads both state.json counter AND scans backlog.md for the actual highest BL-xxx, returns whichever is higher + 1, and updates state.json
  - All code paths that create backlog items must use this function

### BL-016: Make phase badge more prominent and dynamic
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - The phase badge (Building, Reviewing, Deploying, etc) on the Working On card looks too static
  - Make it more prominent — larger, with a subtle pulse or shimmer animation when active
  - Consider colored backgrounds per phase: Building=blue, Reviewing=amber, Deploying=green, Stabilizing=red
  - The badge should feel alive — convey that work is happening right now
  - Only animate when the session is running, not when idle

### BL-015: Show cost tracking on mission control
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Details:**
  - Add a cost card or section to the project mission control page
  - Show total cost (all sessions combined) and current session cost (since last start)
  - Parse cost data from the Claude transcript JSONL files — each result event has cost_usd
  - Show as: "This session: $X.XX · Total: $XX.XX"
  - Update in real-time as the session runs
  - Also show cost per completed backlog item in the Recently Shipped card and backlog detail page

### BL-013: Live tab should tail Claude transcript files
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/BL-013-live-tab-fix.md
- **CEO Note:** REOPENED. Was marked done but Live tab still shows nothing. The transcript resolver and stream route were updated but the EventSource connection in the browser doesn't receive any data. Must be visually verified with Playwright before marking done again.
- **Details:**
  - Live tab shows nothing because it looks for .redeye/session-cto.jsonl which only exists for Control Tower-spawned sessions
  - Sessions started from CLI use the ralph-loop stop hook and don't produce JSONL output
  - Fix: tail Claude's transcript files from ~/.claude/projects/-Users-casa-{project-slug}/*.jsonl instead
  - Find the most recent transcript file by mtime
  - Update the SSE stream API route and stream-utils to use this path
  - The transcript format is JSONL with type/message fields — similar enough to parse

### BL-014: Backlog page should show currently active task as "In Progress" at the top
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - The backlog page shows the currently worked-on task with status "planned" instead of "in-progress"
  - Fix: read state.json for backlog_item, if it matches a backlog item mark it as in-progress
  - Show the active task in a separate "Currently Working On" section at the top of the backlog page with a link to the Live tab
  - The section should have a green left border and pulsing indicator

## Discovered

### BL-017: Cost card leaves empty column in mission control grid
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Source:** User Tester (iteration 32, BUG-1)
- **Details:**
  - Cost card sits alone in left column, leaving right column blank when Questions card spans full width below
  - Fix: make Cost card span full width, or pair it with another card in the grid

### BL-018: Project cards on home page don't show current phase or active task
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/BL-018-home-status.md
- **Source:** User Tester (iteration 32, BUG-2)
- **Details:**
  - ProjectCard always shows "Idle" / "No active task" even when project is running
  - The phase and currentTask fields are not populated from state.json in the projects API
  - Fix: read state.json in the projects list API and pass phase + backlog_title to ProjectCard

### BL-006: Duplicate backlog items cause React key warnings and visual duplicates
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Details:**
  - When a backlog.md file contains the same BL-xxx ID in multiple sections (e.g. CEO Requests and Triaged), parseBacklog returns duplicate items
  - This causes React "duplicate key" console errors on the Mission Control page and shows the same item multiple times in the Up Next list
  - Fixed by adding deduplication in parseBacklog() — keeps the last occurrence when the same ID appears in multiple sections
  - Reproduction: haze project had BL-001 in both CEO Requests and Triaged sections
  - Screenshot: screenshots/T2-mission-control.png (shows duplicate before fix)

### BL-019: Fix cost invariant — session cost can exceed total when cliDir unreadable
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/BL-019-cost-invariant-fix.md
- **Source:** Discovered (iteration 33 — known live bug in BL-015)
- **Details:**
  - In app/api/projects/[id]/cost/route.ts, when cliDir is unreadable the session cost is computed from the active JSONL log but total is computed only from readable transcript files
  - This can cause sessionCost > totalCost, violating the invariant that total >= session
  - Fix: apply Math.max(totalCost, sessionCost) before returning to ensure total always covers session
  - Also guards against any rounding edge cases

### BL-021: Add questionCount to ProjectWithStatus — remove unsafe cast in ProjectCard
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Source:** HARDEN (iteration 37)
- **Details:**
  - ProjectCard line 38 uses `(project as ProjectWithStatus & { questionCount?: number }).questionCount` — unsafe cast
  - Fix: add `questionCount?: number` to `ProjectWithStatus` type and populate it in the projects list API route

### BL-022: Add unit tests for critical API routes (start, stop, restart, backlog CRUD)
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 48)
- **Source:** HARDEN (iteration 37)
- **Details:**
  - 12 API routes have no unit tests: start, stop, restart, steer, pause, init, answer, backlog, backlog/[taskId], sessions, stream, project detail
  - Priority routes to test: start/stop/restart (session lifecycle), backlog CRUD (data integrity)
  - Use vitest with mocked session-manager and redeye-files
- **Shipped:** 2 new test files — `app/api/projects/[id]/start/route.test.ts` (3 tests) and `app/api/projects/[id]/backlog/[taskId]/route.test.ts` (13 tests). Total suite: 343/343 passing.

### BL-023: Add auto-refresh polling to home page project cards
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 62)
- **Source:** HARDEN (iteration 37)
- **Summary:** Added visibility-aware 10-second polling to the home page. Polling starts on mount when the tab is visible, pauses immediately on `visibilitychange` to hidden, and resumes with an instant fetch on re-show. Cleanup removes both the interval and the event listener on unmount. Four vitest tests cover mount, hide, re-show, and unmount scenarios.
- **Details:**
  - Home page only shows project status on initial load — no polling
  - Add a 10-second polling interval (matching mission control pattern) so project cards update phase/task in real-time
  - Pause polling when browser tab is hidden

### BL-024: Add aria-labels to all interactive buttons and controls
- **Type:** ux
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 59)
- **Spec:** docs/specs/BL-024-aria-labels.md
- **Source:** CTO (iteration 37, HARDEN phase)
- **Details:**
  - 14+ interactive buttons across the app have no aria-label, making them inaccessible to screen readers
  - Priority targets: icon-only buttons in mission control cards, dialog action buttons, and expandable toggles in transcript viewer
  - Fix: add descriptive aria-label to all icon-only buttons and ambiguous interactive elements; verify dialog inputs have associated <label> or aria-label
  - Run Playwright accessibility scan after fix to catch remaining issues
- **Summary:** Added aria-labels and linked labels to all interactive buttons and form controls across the dashboard, covering icon-only buttons in mission control cards, dialog fields, and transcript viewer toggles. A dedicated unit test suite and a Playwright E2E spec were added to assert accessible names on key controls.

### BL-025: Wrap unguarded API route handlers in try-catch for safe error responses
- **Type:** tech-debt
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 39)
- **Source:** CTO (iteration 37, HARDEN phase)
- **Details:**
  - Several API route handlers have no try-catch wrapper — a thrown error surfaces as an unhandled 500 with no JSON body instead of a structured { error } response
  - Routes missing top-level try-catch: POST /api/projects/[id]/restart (calls stopSession + startSession uncaught), POST /api/projects/[id]/steer (calls runClaudeCommand uncaught), GET+DELETE /api/projects/[id] (assumes all reads succeed)
  - Additionally, /api/projects/[id]/answer has an empty catch {} block that silently discards state.json write errors
  - Fix pattern: wrap entire handler body in try-catch; return NextResponse.json({ error: e.message }, { status: 500 }) on failure; replace empty catch blocks with at minimum a console.error

### BL-026: Completed backlog items should have a collapsible LLM summary
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 60)
- **Summary:** Backlog detail pages now display a collapsible green-accented Summary section expanded by default for done items, and the Recently Shipped card shows a one-line truncated snippet beneath each item title. The Summary field is parsed from the existing backlog.md format with no schema changes required.
- **Details:**
  - When a backlog item is marked done, generate a short summary of what was done, blockers encountered, and deliverables
  - Show this as a collapsible section on the backlog detail page and in the Recently Shipped card
  - The summary should be written by the CTO at VERIFY/MERGE time and stored in the backlog.md item block as a `- **Summary:**` field
  - If no summary exists for older items, show "No summary available"
  - This requires TWO changes:
  - 1. Control Tower: parse and display the Summary field in backlog detail and shipped card (this repo)
  - 2. RedEye plugin: update verify.md and merge.md agents to write a `- **Summary:**` field when completing items (separate repo ~/redeye — add as steering note, don't edit directly)

### BL-029: Fix Live tab — EventSource connection receives no data despite transcript files existing
- **Type:** bug
- **Priority:** medium
- **Status:** wont-do
- **Reason:** Duplicate of BL-013 (reopened). BL-013 covers the same bug and is currently being planned in iteration 40.

## Triaged

### BL-027: Show cost for completed items in backlog list and detail page
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 47)
- **Source:** VP Product triage (iteration 40)
- **Spec:** docs/specs/BL-027-backlog-list-cost.md
- **Details:**
  - BL-020 added cost-per-item via cost snapshots but the cost is not visible in the backlog list page or detail page
  - Read item_costs from state.json and display cost next to each completed item in the backlog list
  - Show cost on the backlog detail page for done items
  - Format as "$X.XX" in a subtle secondary label
- **Planning note (iter 46):** Detail-page cost already shipped in BL-020 T7. BL-027 focuses on the list page gap; see Q-005 for confirmation.

### BL-020: Show cost per completed backlog item in Recently Shipped card
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/BL-020-cost-per-item.md
- **Source:** User Tester (iteration 32 feedback) + BL-015 spec (not implemented)
- **Details:**
  - The BL-015 spec called out "Also show cost per completed backlog item in the Recently Shipped card and backlog detail page" but this was never implemented
  - In the Recently Shipped card on mission control, each completed item should show its cost contribution (e.g. "$1.42")
  - Store cost snapshot in state.json item_costs map when item transitions to done
  - Show as a subtle secondary label next to each completed item
  - Also show on the backlog detail page
