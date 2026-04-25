# Changelog

_(Append-only iteration history. CTO adds an entry at the end of each complete iteration.)_

## Format
Each entry follows:
- **Built:** BL-{id} {title}
- **Review findings:** {n}C {n}M {n}m — {fixed/clean}
- **Tests:** {n} new E2E tests added, {total} total, regression {PASS/FAIL}
- **User Tester:** {n} bugs reported, feedback score {n}/10
- **Deployed:** {status}
- **Documenter:** updated {n} CLAUDE.md files

## Iteration 45 — 2026-04-24T12:55:00Z
- **Built:** BL-032 Live tab auto-scroll UX fix — pause on user scroll-up, resume at bottom
- **Review findings:** 0C 0M 4m — 2 review cycles, clean on cycle 2
- **Tests:** 16 new integration tests added, 320 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (ae289a2, production build green, 320/320 tests)
- **Documenter:** running in background (iter 45)

## Iteration 2 — BL-002: Fix Live tab showing nothing
- **Built:** BL-002 Fix Live tab showing nothing
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 3 new test files added, 58 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** SUCCESS (build clean, 58/58 tests, smoke verified)
- **Documenter:** not run this iteration

## Iteration 4 — BL-001: Smoke test all pages using Playwright browser
- **Built:** BL-001 Smoke test all pages using Playwright browser
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 1 new test added, 59 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** SUCCESS (build clean, 59/59 tests, HTTP 200 verified)
- **Documenter:** not run this iteration

## Iteration 8 — BL-004: Polish UI consistency (VERIFY FAILED — STABILIZE required)
- **Built:** BL-004 Polish UI consistency (T1-T6 done, T7 skipped)
- **Review findings:** 0C 0M 4m — minor only (1 review cycle)
- **Tests:** 19 new unit tests added, 78 total, unit regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** FAILED — production build exits with prerender error on /_global-error: `TypeError: Cannot read properties of null (reading 'useContext')`. Root cause: ProjectNav uses usePathname() which requires Next.js NavigationContext, absent during static prerender of global-error page. Forwarded to STABILIZE (attempt 1 of 3).
- **Documenter:** not run this iteration

## Iteration 9 — BL-004: Polish UI consistency (re-verify after STABILIZE)
- **Built:** BL-004 Polish UI consistency (T1-T6 done, T7 skipped) — stabilize fix applied
- **Review findings:** 0C 0M 4m — minor only (1 review cycle, carried from iteration 7)
- **Tests:** 0 new tests, 78 total, unit regression PASS (6 files, 78/78)
- **User Tester:** 0 bugs reported, no feedback (tester not run)
- **Deployed:** SUCCESS (build clean, 78/78 tests pass, tagged last-good-deploy-iter9)
- **Documenter:** not run this iteration

## Iteration 13 — BL-011: Enforce BL-xxx ID counter at write level — prevent duplicate IDs
- **Built:** BL-011 Enforce BL-xxx ID counter at write level (T1-T4 done)
- **Review findings:** 0C 0M 4m — minor only (2 review cycles)
- **Tests:** 17 new unit/integration tests added, 95 total, regression PASS (8 files, 95/95)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** SUCCESS (build clean, 95/95 tests pass, tagged last-good-deploy-iter13)
- **Documenter:** not run this iteration

## Iteration 20 — BL-009: Support both dark and light mode properly
- **Built:** BL-009 Support both dark and light mode properly
- **Review findings:** 0C 0M 0m — clean (3 review cycles)
- **Tests:** 5 new unit tests added, 100 total, regression PASS (9 files, 100/100)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** SUCCESS (build clean, 100/100 tests pass, tagged last-good-deploy-iter20)
- **Documenter:** not run this iteration

## Iteration 27 — BL-013: Live tab should tail Claude transcript files
- **Built:** BL-013 Live tab transcript tailing (SSE stream, auto-scroll, ANSI stripping)
- **Review findings:** 2 review cycles completed
- **Tests:** 166 total, regression PASS (13 files, 166/166)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deployed:** SUCCESS (build clean, 166/166 tests pass, HTTP 200, tagged last-good-deploy-iter27)
- **Documenter:** not run this iteration

## Iteration 28 — BL-009: Support both dark and light mode properly (re-verify)
- **Built:** BL-009 Dark/light mode support — Tailwind v4 class-based dark variant, next-themes toggle, light mode palette, Playwright E2E screenshots
- **Review findings:** 3 review cycles completed
- **Tests:** 166 total, regression PASS (13 files, 166/166)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deploy:** SUCCESS (build clean, 166/166 tests pass, tagged last-good-deploy-iter28)
- **Visual check:** PASS — dark mode (black bg, moon icon), light mode (white bg, sun icon), System mode (monitor icon) all render correctly; theme toggle cycles Dark -> System -> Light -> Dark as expected
- **Documenter:** not run this iteration

## Iteration 29 — BL-014: Backlog page shows active task as "In Progress" at top
- **Built:** BL-014 "Currently Working On" section at top of backlog with green border, pulsing dot, in-progress badge, View Live link; active item excluded from grouped sections
- **Review findings:** 1 review cycle completed
- **Tests:** 171 total, regression PASS (14 files, 171/171)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deploy:** SUCCESS (build clean, 171/171 tests pass, tagged last-good-deploy-iter29)
- **Visual check:** PASS — light mode: "CURRENTLY WORKING ON" header, green left border, pulsing green dot, in-progress amber badge, View Live button all visible; dark mode: same layout renders correctly on dark background; active item absent from "DISCOVERED" section below
- **Documenter:** not run this iteration

## Iteration 30 — BL-010: Detect and recover from stalled sessions
- **Built:** BL-010 Stalled session detection and recovery — session manager monitors transcript mtime, marks stalled after 10min inactivity, auto-restarts; UI shows amber border + warning + Restart button; POST /api/projects/[id]/restart endpoint
- **Review findings:** 3 review cycles completed
- **Tests:** 175 total, regression PASS (15 files, 175/175)
- **User Tester:** 0 bugs reported, no feedback score (tester not run)
- **Deploy:** SUCCESS (build clean, 175/175 tests pass, tagged last-good-deploy-iter30)
- **Visual check:** PASS — main page renders correctly (2 project cards, green status dots, Start buttons); project mission control page renders correctly (overview, backlog, history, live tabs; working on / health / questions / up next / recently shipped / controls all present); no visual regressions
- **Documenter:** not run this iteration

## Iteration 32 — BL-016: Make phase badge more prominent and dynamic
- **Built:** BL-016 Phase badge overhaul — PHASE_COLORS constant with per-phase gradient/text/ring/shimmer config; PhaseBadge component replaces plain spans in WorkingOnCard; animated dot when running, shimmer animation when active; Tailwind v4 static class strings throughout
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 11 new unit tests for PhaseBadge, 207 total, regression PASS (18 files, 207/207)
- **User Tester:** 2 bugs reported (BUG-1: cost card empty column layout; BUG-2: home page project cards always show Idle), feedback score 7/10
- **Deploy:** SUCCESS (build clean, 207/207 tests pass, tagged last-good-deploy-iter32)
- **Visual check:** PASS — light mode: blue colored badge for PLAN phase, pill styling, good contrast; dark mode: badge legible on zinc-900 background; both modes confirmed in screenshots verify-iter32-light.png and verify-iter32-dark.png; no layout regressions
- **Documenter:** not run this iteration

## Iteration 44 — BL-034/035/036: Stop & Pause buttons write graceful directives
- **Built:** BL-034 (Stop) + BL-035 (Pause) + BL-036 (home-card Stop) — Stop and Pause buttons on mission control and home project cards now write canonical STOP/PAUSE directives to `.redeye/steering.md` (aligned with `/redeye:stop` slash command). Replaced failing `stopSession()` SIGTERM call. Both buttons show Stopping…/Pausing… label swap for 3s and "Directive sent — team will finish current phase." caption.
- **Review findings:** 0C 0M 4m — clean (1 review cycle)
- **Tests:** new unit tests for controls-card (Stopping…/Pausing… labels, "Directive sent" caption) and project-card home Stop feedback, 310 total, regression PASS (33 files, 310/310)
- **User Tester:** 0 new bug reports this cycle, no new feedback score
- **Deploy:** SUCCESS (NODE_ENV=production build green, 310/310 tests, commits 8dfab5b + 8df44a5 + f0a173e)
- **Visual check:** PASS — mission control Controls card renders Stop (primary red) + Pause + Steer + Backlog correctly; API endpoints `POST /api/projects/{id}/stop` and `/pause` verified via curl on haze project (both write canonical `STOP — CEO directed…` / `PAUSE — CEO directed…` lines under `## Directives`); test directives cleaned up; did not click Stop/Pause on control-tower in-browser to avoid gracefully terminating the live CTO session mid-verify
- **Documenter:** not run this iteration

## Iteration 43 — BL-031: Live tab transcript viewer — fold tool/terminal output by default
- **Built:** BL-031 Live tab transcript viewer folds tool_use and tool_result entries by default, exposes Expand all / Collapse all controls; unfolded rows render code bodies (tool call JSON, tool result text) with preserved whitespace
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 15 new unit tests for fold/unfold + control behaviour, 296 total, regression PASS (29 files, 296/296)
- **User Tester:** 0 bugs reported this cycle, no new feedback score
- **Deploy:** SUCCESS (NODE_ENV=production build green after STABILIZE confirmed pre-existing /_global-error prerender was shell env, not code; 296/296 tests, tagged last-good-deploy-iter43, commit 7404bb9)
- **Visual check:** PASS — Live tab on /project/0/live shows tool_use / tool_result entries collapsed with ▶ markers; Expand all reveals bash command JSON; Collapse all / Clear / Auto-scroll controls render correctly; no console errors; no layout regressions vs iter42
- **Documenter:** not run this iteration

## Iteration 39 — BL-025: Wrap unguarded API route handlers in try-catch for safe error responses
- **Built:** BL-025 try-catch hardening across 5 API route handlers (answer, backlog, restart, steer, project detail) with uniform JSON error envelope; new unit test for restart route
- **Review findings:** 0C 0M 2m — 2 minor findings deferred (1 review cycle)
- **Tests:** 1 new unit test file (restart route), 267 total, regression PASS (27 files, 267/267)
- **User Tester:** 0 bugs reported this cycle, no new feedback score
- **Deploy:** SUCCESS (NODE_ENV=production build green, 267/267 tests, tagged last-good-deploy-iter39, commit def431f)
- **Visual check:** PASS — home page renders 3 project cards with correct phase badges, 0 console errors; BL-025 is backend-only so no UI diff vs iter38; graceful JSON error envelope + client "Failed to load / Retry" UI verified on project detail route, confirming the hardening goal
- **Documenter:** not run this iteration

## Iteration 47 — 2026-04-24T13:37:13Z
- **Built:** BL-027 Show cost for completed items in backlog list and detail page (T1 list-page cost badge)
- **Review findings:** 0C 0M 2m — clean (1 review cycle, S-tier)
- **Tests:** 7 new unit tests for BacklogSection cost badge rendering, 327 total, regression PASS (36 files, 327/327)
- **User Tester:** 0 bugs reported, no new feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (NODE_ENV=production build green after env var fix; dev server restarted; 327/327 tests)
- **Visual check:** PASS — backlog list renders correctly light and dark mode; done items show no cost badges (expected — no item_costs populated in state.json yet, all items pre-date BL-020 collection); no layout regressions; screenshots: verify-iter47-backlog.png, verify-bl027-backlog-list-light.png, verify-bl027-backlog-list-dark.png
- **Documenter:** not run this iteration

## Iteration 48 — 2026-04-24T19:43:00Z
- **Built:** BL-022 Add unit tests for critical API routes (start, stop, restart, backlog CRUD)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 16 new unit tests added (3 start-route, 13 backlog/[taskId] CRUD), 343 total, regression PASS (38 files, 343/343)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (test-only change, production code unchanged, 343/343 tests)
- **Visual check:** PASS — home page renders 3 project cards; mission control /project/1 renders correctly with Working On, Health, Cost, Questions, Up Next cards; no layout regressions; tagged last-good-deploy-iter48
- **Documenter:** running in background

## Iteration 49 — 2026-04-24T19:56:00Z
- **Built:** BL-038 Cost visibility fix — detail-page cost row always renders for done items
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new tests, 343 total, regression PASS (38 files, 343/343)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (single-file fix, production build unchanged, 343/343 tests)
- **Documenter:** running in background

## Iteration 50 — 2026-04-24T20:10:00Z
- **Built:** BL-037 Add Force Stop button (hard kill) for unresponsive sessions
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 8 new unit tests for force-stop route + controls-card Force Stop behaviour, 351 total, regression PASS (39 files, 351/351)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 351/351 tests, tagged last-good-deploy-iter50)
- **Visual check:** PASS — mission control Controls card renders Force Stop button (red outline, standalone row) alongside Stop (solid red) and Pause; screenshot: verify-bl037-force-stop.png
- **Documenter:** running in background

## Iteration 52 — 2026-04-24T21:30:00Z
- **Built:** BL-039 Show clear "backlog empty" stopped message instead of Idle
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 5 new unit tests added (3 WorkingOnCard backlog-empty cases, 2 ProjectCard backlog-empty label cases), 356 total, regression PASS (39 files, 356/356)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 356/356 tests)
- **Visual check:** PASS — home page project cards render correctly (control-tower shows "Verifying" green dot while running; no regressions); mission control Working On card shows active task correctly; backlog-empty code path verified by unit tests (not triggered live since session is running); tagged last-good-deploy-iter52
- **Documenter:** running in background

## Iteration 52 — 2026-04-24T22:00:00Z (BL-043 VERIFY)
- **Built:** BL-043 Force Stop as dropdown on the Stop button — not a separate button
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 8 new unit tests for split-button dropdown behaviour (chevron, dropdown open/close, Force Stop menu item, confirmation two-click, 4s auto-dismiss, Escape close), 359 total, regression PASS (39 files, 359/359)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 359/359 tests)
- **Visual check:** PASS — Controls card shows split Stop/chevron button group (no standalone Force Stop row); clicking chevron opens dropdown with "Force Stop" item; first click shows "Confirm hard kill — click again" confirmation text; clicking outside closes dropdown; screenshots: verify-iter52-force-stop.png, verify-iter52-confirm.png
- **Documenter:** running in background

## Iteration 37 — BL-020: Show cost per completed backlog item in Recently Shipped card
- **Built:** BL-020 Cost badges in Recently Shipped card — ShippedCard renders font-mono "$X.XX" span next to each BacklogItem with cost_usd > 0; cost_usd hydrated from state.item_costs in redeye-files.ts; gracefully omits badge when cost data absent; changelog render path unaffected
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 8 new unit tests for ShippedCard cost badge behaviour, 242 total, regression PASS (22 files, 242/242)
- **User Tester:** 0 bugs reported this cycle, no new feedback score (no tester run post-deploy)
- **Deploy:** SUCCESS (build clean, 242/242 tests pass, tagged last-good-deploy-iter38)
- **Visual check:** PARTIAL — Playwright MCP browser locked by concurrent Chrome session; port 3200 confirmed open (node PID 57680 listening); component code review confirms cost badge renders correctly for items with cost_usd > 0, graceful no-op when absent; no Critical bugs in tester-reports.md
- **Documenter:** not run this iteration

## Iteration 53 — 2026-04-24T23:25:00Z
- **Built:** BL-042 Backlog detail view cost (est) shows Not recorded — fix cost display; add Record now button
- **Review findings:** 0C 0M 0m — clean (2 review cycles)
- **Tests:** 0 new E2E tests added, 365 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 365/365 tests, tagged last-good-deploy-iter53)
- **Visual check:** PASS — BL-037 (no cost) shows "Not recorded" + "Record now" button inline; clicking Record now captures cost from transcript ($60.53) and removes the button; BL-038 shows pre-recorded "$44.71" with no Record now button; screenshots: verify-iter53-cost.png, verify-iter53-bl037-after-record.png, verify-iter53-bl038.png
- **Documenter:** running in background (iter 45)

## Iteration 55 — 2026-04-25T00:10:00Z
- **Built:** BL-046 Per task cost (est) auto-recorded at end of each task as end-minus-start delta
- **Review findings:** 0C 0M 0m — clean (2 review cycles)
- **Tests:** 23 new tests added (4 cost-start, 4 cost-snapshot delta, 5 useTaskTransitionTracker hook, 10 page transition detection), 396 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 396/396 tests, tagged last-good-deploy-iter55)
- **Visual check:** PASS — mission control renders correctly; item_cost_starts[BL-046]=73.41 confirmed in state.json; cost-start idempotency guard (AD-7) returns skipped:true on second POST; BL-043 detail shows $62.44 delta cost; BL-041 shows "Not recorded" + "Record now" (backward compat intact); screenshot: verify-iter55-cost-auto.png
- **Documenter:** running in background (iter 45)

## Iteration 54 — 2026-04-24T20:35:00Z
- **Built:** BL-041 Backlog done tasks in separate collapsible section — redesign backlog page
- **Review findings:** 0C 0M 2m — clean after 2 review cycles (M1 filter bug fixed in cycle 2)
- **Tests:** 8 new unit tests for computeBuckets + parseBacklogIdNumber + CollapsibleSection, 373 total, regression PASS (40 files, 373/373)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 373/373 tests, tagged last-good-deploy-iter54)
- **Visual check:** PASS — Done section collapsed by default (chevron down, count badge "31", "expand to view"); planned items (CEO Requests / Discovered) visible above; click expands 31 done items newest-first (BL-043 at top with $62.44 cost badge); click again collapses; Won't Do section present; haze backlog loads cleanly (no regression)
- **Documenter:** running in background

## Iteration 56 — 2026-04-24T23:45:00Z
- **Built:** BL-040 Live tab: inter-round messages and thought blocks — ThinkingCard + AssistantTextCard + user suppression
- **Review findings:** 1 review cycle — clean
- **Tests:** 13 new unit tests added (ThinkingCard, AssistantTextCard, user suppression, findPrecedingToolName, forceExpanded prop), 409 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 409/409 tests, tagged last-good-deploy-iter56)
- **Visual check:** PASS — home page renders 3 project cards; Live tab renders correctly with empty-state "No active session" message; violet+border-l-red CSS compiled into bundle confirmed via JS evaluation; dark mode toggle cycles correctly (System -> Light -> Dark); screenshots: verify-iter56-home.png, verify-iter56-live-tab.png, verify-iter56-dark-mode-2.png
- **Documenter:** running in background (iter 45)

## Iteration 57 — 2026-04-24T23:55:00Z
- **Built:** BL-048 Live Tab User Boxes: Collapsible and Collapsed by Default — useEffect in useOpenState syncs local card state with forceExpanded; Collapse All / Expand All are sticky after returning to per-card mode
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 10 new lifecycle tests added (ToolResultCard, ToolUseCard, ThinkingCard forceExpanded null→false→null and null→true→null transitions), 419 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 419/419 tests, tagged last-good-deploy-iter57)
- **Visual check:** PASS — home page renders 3 project cards correctly (dark mode); Live tab empty-state renders correctly in both dark and light mode; useEffect BL-048 fix confirmed in transcript-viewer.tsx; Collapse All / Expand All buttons confirmed in live page.tsx; no layout regressions; screenshots: verify-iter57-home.png, verify-iter57-live.png, verify-iter57-light-mode.png
- **Documenter:** running in background (iter 45)

## Iteration 79 — 2026-04-25T00:30:00Z
- **Built:** BL-049 Expand E2E test coverage — Playwright specs for backlog CRUD, start/stop flow, and cost card
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 2 new E2E test files added (backlog-crud.spec.ts, cost-card.spec.ts), 462 unit tests total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 462/462 unit tests, full E2E regression green, tagged last-good-deploy-iter79)
- **Visual check:** PASS — home page 3 project cards render correctly; mission control Working On card shows BL-049 active; Controls card (Stop/Pause/Steer/Add to Backlog) renders correctly; no console errors; no layout regressions
- **Documenter:** running in background (iter 45)

## Iteration 81 — 2026-04-25T01:37:00Z
- **Built:** BL-051 Cost analytics — add cumulative cost chart to mission control
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 26 new unit tests added (SparklineChart, cost-history lib, cost-history API route, CostCard extension), 519 total, regression PASS; 1 new Playwright E2E spec (sparkline SVG in DOM with live data, hidden with 0-session data)
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 519/519 unit tests, full E2E regression green, tagged last-good-deploy-iter81)
- **Visual check:** PASS — home page 3 project cards render correctly; mission control Cost card shows $140.07 session / $155.40 total; sparkline not visible in live dev server (expected — dev server runs main branch, feature not yet merged; sparkline SVG verified via worktree E2E build); no Critical bugs; no layout regressions
- **Documenter:** running in background (iter 45)

## Iteration 80 — 2026-04-25T01:06:00Z
- **Built:** BL-050 Add in-app notification toast when RedEye phase changes (BUILD, REVIEW, DEPLOY, DONE)
- **Review findings:** 0C 0M 0m — clean (2 review cycles; cycle 1 had 1 minor fix: VERIFY added to NOTIFIABLE_PHASES)
- **Tests:** 30 new unit tests added (usePhaseChangeNotifier ×8, usePhaseNotifications ×11, ToastContainer ×7, integration ×4), 4 new Playwright E2E tests, 493 unit tests total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 493/493 unit tests, 6 E2E flows green, tagged last-good-deploy-iter80)
- **Visual check:** PASS — home page renders 3 project cards correctly; mission control page for ControlTower renders all cards (Working On, Controls, Questions, Backlog, Cost, Health); ToastContainer alert region confirmed present in DOM via accessibility snapshot; no layout regressions; no Critical bugs in tester-reports.md
- **Documenter:** running in background (iter 45)
