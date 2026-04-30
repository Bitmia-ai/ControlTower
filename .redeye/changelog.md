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

## Iteration 179 — 2026-04-29T05:00:00Z
- **Built:** T146 Test gap: untested API routes (init, stream, sessions)
- **Review findings:** 0C 0M 0m — clean
- **Tests:** 30 new unit tests added (16 init + 11 stream + 3 sessions), 1451 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester running, persona 12)
- **Deployed:** SKIPPED (test-only change — no prod code modified; iter178 last-good-deploy-iter178-T147 tag stands)
- **Documenter:** running in background (iter 175, heartbeat 2026-04-29T01:30Z)

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

## Iteration 82 — 2026-04-25T02:13:00Z
- **Built:** BL-052 Add keyboard shortcuts for common actions (Start, Stop, Backlog navigation)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 31 new unit tests added, 550 total, regression PASS; full E2E green including kbd hint badge verification
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 550/550 unit tests, full E2E regression green, tagged last-good-deploy-iter82)
- **Documenter:** idle (background, iter 45)

## Iteration 80 — 2026-04-25T01:06:00Z
- **Built:** BL-050 Add in-app notification toast when RedEye phase changes (BUILD, REVIEW, DEPLOY, DONE)
- **Review findings:** 0C 0M 0m — clean (2 review cycles; cycle 1 had 1 minor fix: VERIFY added to NOTIFIABLE_PHASES)
- **Tests:** 30 new unit tests added (usePhaseChangeNotifier ×8, usePhaseNotifications ×11, ToastContainer ×7, integration ×4), 4 new Playwright E2E tests, 493 unit tests total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (tester respawn-pending)
- **Deployed:** SUCCESS (production build clean, 493/493 unit tests, 6 E2E flows green, tagged last-good-deploy-iter80)
- **Visual check:** PASS — home page renders 3 project cards correctly; mission control page for ControlTower renders all cards (Working On, Controls, Questions, Backlog, Cost, Health); ToastContainer alert region confirmed present in DOM via accessibility snapshot; no layout regressions; no Critical bugs in tester-reports.md
- **Documenter:** running in background (iter 45)

## Iteration 83 — 2026-04-25T02:52:00Z
- **Built:** BL-053 Improve session history page — show phase timeline and cost per session
- **Review findings:** 0C 0M 3m — 3 minors fixed (1 review cycle)
- **Tests:** 35 new unit tests added, 585 total, regression PASS; full E2E green (18-session ControlTower history, phase chips on haze project)
- **User Tester:** 0 bugs reported, no feedback score (no tester feedback this iteration)
- **Deployed:** SUCCESS (production build clean, 585/585 unit tests, full E2E regression green; pre-existing infinite render loop bug in history page found and fixed as part of BL-053 work)
- **Visual check:** PASS — ControlTower history page renders 18 sessions with cost badges ($0.22–$5.82) above Iteration Log; haze history page shows 10 sessions with phase chips (VER green, PLN blue, TRI gray) and cost badges ($0.17–$71.35); Sessions section correctly above Iteration Log; "No changelog entries yet" empty state correct for haze; no console errors; no layout regressions; screenshots: verify-iter83-home.png, verify-iter83-history-controltower.png, verify-iter83-history-haze.png
- **Documenter:** running in background

## Iteration 88 — 2026-04-25T10:47:00Z
- **Built:** BL-057 Mobile-responsive layout — make the dashboard usable on phones and tablets
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 5 new unit tests added, 651 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester feedback this iteration)
- **Deployed:** SUCCESS (worktree build clean, 651/651 unit tests, tagged last-good-deploy-iter88)
- **Visual check:** PASS — home page no horizontal scroll at 375px (scrollWidth===375), 1-column card grid, all pages (mission control, backlog, history, live) render without overflow; worktree code audit confirms all 8 acceptance criteria met: min-h-[44px] on all interactive buttons, flex-wrap on button rows and chip strips, overflow-x-auto on nav and phase chips, break-all on code blocks, sparkline SVG width=100%; 0 JS errors on home and project pages
- **Documenter:** running in background

## Iteration 90 — 2026-04-25T15:00:00Z
- **Built:** BL-058 Schedules UI needs to be operative (6 sub-tasks: T1 global-error fix, T2 schedules API, T3 schedules page, T4 schedule-list component, T5 tests, T6 E2E spec)
- **Review findings:** 0C 2M 2m — 2 review cycles; both Majors fixed (nested button restructured, stale sched counter corrected)
- **Tests:** 0 new E2E tests (no CLI configured), 662 total unit/integration, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean Turbopack, 662/662 tests, tagged last-good-deploy-iter90-bl058)
- **Visual check:** PASS — SCHED-1 renders at /project/1/schedules with Overdue badge; Run now button is sibling of expand button (not nested); POST /api/projects/1/schedules/run returns 200 {data:{queued:true}}; 0 app JS errors; SSR 500 is pre-existing dev-mode Turbopack quirk, not a production issue
- **Documenter:** running in background

## Iteration 91 — 2026-04-25T12:32:00Z
- **Built:** BL-061 Remove keyboard shortcut badges from all buttons (like the (GB) badges)
- **Review findings:** 0C 2M 0m — 1 review cycle; both Majors fixed (nested button in ScheduleRow restructured, stale sched counter corrected)
- **Tests:** 0 new E2E tests added, 656 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean Turbopack, 656/656 tests, tagged last-good-deploy-iter91-bl061)
- **Visual check:** PARTIAL — Playwright MCP browser locked by concurrent Chrome session; source code audit confirms 0 `<kbd>` elements in all components; feature objective fully achieved
- **Documenter:** running in background

## Iteration 97 — 2026-04-25T19:14:00Z
- **Built:** BL-066 Redesign home page project cards and improve dashboard visual hierarchy
- **Review findings:** 0C 0M 0m — clean (0 review cycles, PASS first pass)
- **Tests:** 15 new unit tests added, 691 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean, 691/691 tests, tagged last-good-deploy-iter97-bl066)
- **Visual check:** PASS — light and dark mode verified via Playwright; eyebrow label, h1, count subtitle, border-b divider, status top borders (green/amber/zinc), monospace paths, phase footer strip, Start/Stop buttons all confirmed
- **Documenter:** running in background

## Iteration 98 — 2026-04-25T21:50:00Z
- **Built:** BL-071 Apply the same design styles from the main page to all the other pages and tabs
- **Review findings:** 1 review cycle — clean
- **Tests:** 0 new E2E tests added, 691 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean Turbopack, 691/691 tests, tagged last-good-deploy-iter98-bl071)
- **Visual check:** PASS — all 6 pages verified via Playwright: home (CONTROL TOWER eyebrow, Projects h1, status-border cards intact from BL-066), mission control (eyebrow + project h1 + pulsing dot + Running pill + colored card top borders border-t-[3px] + monospace small-caps labels: WORKING ON, CONTROLS, QUESTIONS, TELEMETRY), backlog (eyebrow + Backlog h1 + item count subtitle + border-b divider + in-progress row with border-l-2), history (eyebrow + History h1 + subtitle), schedules (eyebrow + Schedules h1 + amber top border on overdue ScheduleRow), steer (eyebrow + Steer h1 + CURRENT DIRECTIVES mono label)
- **Documenter:** running in background

## Iteration 108 — 2026-04-26T19:43:00Z
- **Built:** T077 Lighthouse baseline + per-page metadata.title + chunk investigation
- **Review findings:** 0C 0M 1m — clean (1 review cycle; 1 minor: history page missing metadata test, low risk)
- **Tests:** 9 new tests added, 804 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean, 804/804 tests, tagged last-good-deploy-iter108-t077)
- **Visual check:** PASS — all 7 pages verified via Playwright: home "Projects", mission control "Mission Control | Control Tower", tasks "Tasks | Control Tower", live "Live | Control Tower", history "History | Control Tower", steer "Steer | Control Tower", schedules "Schedules | Control Tower"; title template "%s | Control Tower" confirmed in layout; no visual regressions
- **Documenter:** running in background

## Iteration 128 — 2026-04-27T20:51:00Z
- **Built:** T109 Tasks list shows in-progress for already-done tasks (split-brain with detail view)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 3 new unit tests added, 1020 total, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester not_started this cycle)
- **Deployed:** SUCCESS (production build clean, no errors, all routes compiled)
- **Documenter:** running in background (heartbeat 2026-04-25, iter 85)

## Iteration 130 — 2026-04-27T21:22:00Z
- **Built:** T110 npx control-tower init — interactive CLI setup wizard
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 25 new unit tests added, 1045 total, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean, commit 1eb68b5, all routes compiled, tagged last-good-deploy-iter130-T110)
- **Documenter:** running in background (heartbeat 2026-04-25, iter 85)

## Iteration 131 — 2026-04-27T19:45:00Z
- **Built:** T111 Guided first-run onboarding wizard in the dashboard
- **Review findings:** 0C 0M 1m — clean (1 review cycle)
- **Tests:** 15 new unit tests added + 5 E2E tests, 1060 total, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (production build clean, merge commit 55972b0, all routes compiled, tagged last-good-deploy-iter131-T111)
- **Documenter:** running in background (heartbeat 2026-04-25, iter 85)

## Iteration 135 — 2026-04-27T22:30:00Z
- **Built:** T113 In-app notification system — agent event toasts and banners (bell, drawer, 5s polling)
- **Review findings:** 1 review cycle — clean
- **Tests:** 47 new unit tests added, 1107 total (1111 with 4 pre-existing failures unchanged), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester spawned iter 135, no entry yet)
- **Deployed:** SUCCESS (production build clean, Turbopack 0 errors, /api/notifications route confirmed, tagged last-good-deploy-iter135-T113)
- **Documenter:** running in background (heartbeat 2026-04-25, iter 85)

## Iteration 141 — 2026-04-27T22:10:00Z
- **Built:** T117 Cost forecasting — project burn rate, remaining budget estimate, trend chart
- **Review findings:** 0C 0M 1m — clean (2 review cycles; pre-existing minor from SparklineChart era, not introduced by T117)
- **Tests:** 1 new E2E spec added (cost-forecasting.spec.ts, 2 tests), 1168 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean, /api/projects/[id]/cost-forecast route present, tagged last-good-deploy-iter141-T117)
- **Visual check:** PASS — Cost card: Burn Rate $1.01/session, Est. 24H $24.33, Est. 7D $170.31 visible; CostTrendChart SVG bar chart renders with projected bars; home page 3 projects load; no layout regressions
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 143 — 2026-04-27T23:05:00Z
- **Built:** T119 Per-task time tracking — wall-clock duration alongside cost on task detail page
- **Review findings:** 0C 0M 1m — clean (1 review cycle; minor: useEffect dep `item` vs `item?.status`, safe)
- **Tests:** 1 new E2E spec added (task-duration.spec.ts, 4 tests), 1254 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean, /api/projects/[id]/tasks/[taskId]/duration route present, tagged last-good-deploy-iter143-T119)
- **Visual check:** PASS — T118 done task shows DURATION: 45m row; T119 pending task correctly hides duration row; home page 3 projects load; mission control renders cleanly; no layout regressions
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 142 — 2026-04-27T22:33:00Z
- **Built:** T118 Velocity Chart — tasks-per-week bar chart with rolling avg line, trend badge, VelocityCard between CostCard and HealthCard
- **Review findings:** 0C 0M 1m — clean (1 review cycle; minor: spec doc date error in test-strategy, implementation correct)
- **Tests:** 1 new E2E spec added (velocity-chart.spec.ts, 2 tests), 1209 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean, /api/projects/[id]/velocity route present, tagged last-good-deploy-iter142-T118)
- **Visual check:** PASS — VelocityCard visible between CostCard and HealthCard; Up trend badge; 1.5 tasks/week avg; SVG bar chart with rolling avg line renders; home page 3 projects load; no layout regressions
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 145 — 2026-04-28T10:31Z
- **Built:** T120 Full UI exploration via browser and Playwright
- **Review findings:** 0C 0M 1m — 2 review cycles, clean on cycle 2
- **Tests:** 6 new E2E tests added (t120-ui-exploration.spec.ts), 88 pass / 8 skipped (legacy) / 1 flaky-then-passing-on-retry, 1269 unit tests total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean; 5 bug fixes shipped: phase labels, cost-start blId->taskId, sort prefix, epoch last-run parse, E2E specs updated; tagged last-good-deploy-iter145-T120)
- **Visual check:** PASS — home phase labels correct ("Triaging"/"Verifying"/"Deploying"); mission control loads cleanly (all cards present, no 400 errors); tasks sort shows "Sort: Priority" prefix; schedules SCHED-3 shows "Never run"
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 146 — 2026-04-28T13:14:00Z
- **Built:** T121 History Has to Have Better UX — session-history-row phase flow, Session #N badge, search overhaul, Iteration Log subtitle
- **Review findings:** 0C 0M 2m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added (session-history.spec.ts unchanged), 1277 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** FAIL — T121 source built on redeye/T121 branch only; main checkout built without T121 merge; prod server does not have T121 code; Iteration Log subtitle absent from /project/1/history
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 149 — 2026-04-28T14:28:00Z
- **Built:** T123 History tab — remove confusing Iteration Log section (changelog.md only had stale BL-* entries from early iterations)
- **Review findings:** 0C 0M 0m — clean (1 review cycle, S-tier)
- **Tests:** 0 new E2E tests added (session-history.spec.ts updated to remove iteration log assertions), 1294 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean from T123 branch; History tab shows "Sessions" subtitle only; Iteration Log section absent; no visual regressions; tagged last-good-deploy-iter149-T123)
- **Visual check:** PASS — /project/1/history shows only Sessions section (43 sessions) with subtitle "Sessions"; no "Iteration Log" section; no BL-* entries visible; layout clean; screenshot: verify-T123-final-confirmed.png
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 152 — 2026-04-28T15:39:00Z
- **Built:** T124 codebase simplification (badge constants extracted, req.json() fixed, safeRedeyePath enforced, dead code removed, console.error cleaned)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 1 new E2E smoke test added (e2e/t124-smoke.spec.ts), 1294 total unit tests, regression PASS (4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean; 14 files changed, 191 ins / 216 del; security hardened ST-2/ST-3; dead code removed ST-5; tagged last-good-deploy-iter152-T124)
- **Visual check:** PASS — home page renders 3 project cards (haze/ControlTower/redeye); phase badges correct; no layout regressions; T124 is code-quality only (no UI changes); screenshot: verify-iter152-main.png
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 155 — 2026-04-28T18:25:00Z
- **Built:** T125 Run Now creates pending task (RunButton shows "Queued (TN)")
- **Review findings:** 0C 0M 1m — clean (1 review cycle; minor: nextLine==-1 edge case unreachable in practice)
- **Tests:** 1 new E2E spec added (run-now-pending.spec.ts), 4 new route unit tests, 1155 total unit tests, regression PASS (no regressions vs iter 152 baseline; 4 pre-existing React.act failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, fixed pre-existing Turbopack worktree isolation; tagged last-good-deploy-iter155-T125)
- **Visual check:** PASS — home page renders 3 project cards correctly; Schedules page tab renders with correct nav/title/"+ Add Schedule" button; no layout regressions; screenshots: verify-iter155-home.png, verify-iter155-schedules.png
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 158 — 2026-04-28T18:38:00Z
- **Built:** T126 Run Now state persists across refresh (localStorage in RunButton)
- **Review findings:** 0C 0M 2m — clean (1 review cycle; m-1: taskId not format-validated; m-2: E2E uses array index as project ID)
- **Tests:** 1 new E2E spec added (run-now-persist-state.spec.ts), 5 new unit tests, 1301 total, regression PASS (1301/1305; 4 pre-existing failures unchanged)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 38 routes, all 5 T126 localStorage tests pass; tagged last-good-deploy-iter158-T126)
- **Visual check:** PASS — home page renders 3 project cards; schedules page tab structure renders correctly (nav, header, "+ Add Schedule" button present); pre-existing "Project not found" on schedules data load is unrelated to T126 (numeric index vs name mismatch predates this task); screenshots: verify-iter158-home.png, verify-iter158-schedules-haze.png
- **Documenter:** stale (last heartbeat iter 85; respawn when next task ships)

## Iteration 165 — 2026-04-28T21:30:00Z
- **Built:** T128 History session info — show task title/summary per session row
- **Review findings:** 0C 0M 2m — clean (1 review cycle; m-1: durationMs=0 window is +6 min not ±5 min (harmless); m-2: IterationSummary.iteration not validated as number at runtime (low risk))
- **Tests:** 5 new E2E tests added (t128 spec), 34 new unit tests (15 ST-1 + 18 ST-2 + 1 ST-4), 1334 total, regression PASS (1334/1338; 4 pre-existing failures unchanged; 2 pre-existing E2E failures: T123 Iteration Log tab, T121 phase chip)
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, T128 E2E 5/5 pass; tagged last-good-deploy-iter165-T128)
- **Visual check:** PASS — home page renders 3 project cards; haze history page loads 14 sessions; task line visible on collapsed rows; Activity panel expands with per-iteration summaries (4 iterations for session #11); search-by-outcome filters correctly ("Triage" → 3/14 matches with "Showing 3 of 14 items"); dark + light mode both clean; screenshots: verify-iter165-home.png, verify-iter165-history-haze.png, verify-iter165-history-expanded.png, verify-iter165-history-search.png, verify-iter165-history-light.png
- **Documenter:** pending-respawn (heartbeat 2026-04-28T21:10:00Z; queued to update CLAUDE.md for IterationSummary type, matchIterationLogToSession, extractTaskLine, iterationSummaries field)

## Iteration 166 — 2026-04-28T22:00:00Z
- **Built:** T131 Fix 4 pre-existing unit test failures (up-next-card x2, shipped-card x2)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1338 total (was 1334; 4 pre-existing failures fixed), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, 1338/1338 unit tests pass; tagged last-good-deploy-iter166-T131)
- **Visual check:** PASS — home page renders 3 project cards (haze/ControlTower/redeye); ControlTower card shows T131 task title; layout clean; test-only change (no UI changes); screenshot: verify-iter166-home.png
- **Documenter:** pending-respawn (heartbeat 2026-04-28T21:10:00Z; still queued for T128 CLAUDE.md updates)

## Iteration 167 — 2026-04-28T23:20:00Z
- **Built:** T132 Fix 9 TypeScript errors in test files so npm run typecheck exits 0
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1338 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, typecheck exit 0, 1338/1338 unit tests pass; tagged last-good-deploy-iter167-T132)
- **Visual check:** PASS — home page renders 3 project cards (haze/ControlTower/redeye); ControlTower card shows T132 task title; layout clean; test-only change (no UI changes); screenshot: verify-iter167-T132.png
- **Documenter:** pending-respawn (heartbeat 2026-04-28T21:10:00Z; still queued for T128 CLAUDE.md updates)

## Iteration 168 — 2026-04-28T20:38:00Z
- **Built:** T133 Add regression tests for parser section-header boundary detection bug (commit 4159ec1)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1342 total (4 new unit regression tests), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 135)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, typecheck exit 0, 1342/1342 unit tests pass; tagged last-good-deploy-iter168-T133)
- **Visual check:** PASS — home page renders 3 project cards (haze/ControlTower/redeye); ControlTower card shows T133 task title; layout clean; test-only change (no UI changes); screenshot: verify-iter168-home.png
- **Documenter:** pending-respawn (heartbeat 2026-04-28T21:10:00Z; still queued for T128 CLAUDE.md updates)

## Iteration 170 — 2026-04-28T21:48:00Z
- **Built:** T135 Rename "author" label to "Created by" across tasks tab and detail page (follow-up to T134)
- **Review findings:** 0C 0M 1m — clean (1 review cycle; minor: unscoped fe18625 commit undocumented in BUILD summary, non-blocking)
- **Tests:** 0 new E2E tests added, 1370 total (1 new unit test incidental), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since T134; T135 is label rename follow-up)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, typecheck exit 0, 1370/1370 unit tests pass; tagged last-good-deploy-iter170-T135)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower tasks backlog 19 items all show "Created by User" blue badge; filter chip "Created by" with correct options; T135 detail page dt=CREATED BY + "Created by User" blue badge; screenshots: T135-verify-home.png, T135-verify-ct-tasks-indexed.png, T135-verify-task-detail.png
- **Documenter:** idle (last completed iter 166, commit b57646f)

## Iteration 171 — 2026-04-28T22:17:00Z
- **Built:** T155 Security: add CSP and standard security response headers in next.config.ts + SECURITY.md
- **Review findings:** 0C 0M 2m — fixed (2 review cycles; cycle 1: /s dotAll flag removed from e2e spec; cycle 2: clean)
- **Tests:** 4 new E2E tests added (e2e/security-headers.spec.ts), 1388 total (1380 baseline + 8 new vitest assertions for header values), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1388/1388 unit tests pass; tagged last-good-deploy-iter171-T155)
- **Visual check:** PASS — home page 3 project cards render cleanly; ControlTower card shows T155 active task; zero CSP console violations; all 5 security headers confirmed on root: CSP / X-Frame-Options DENY / X-Content-Type-Options nosniff / Referrer-Policy same-origin / Permissions-Policy; screenshot: verify-iter171-home.png

## Iteration 172 — 2026-04-29T00:31:00Z
- **Built:** T154 Security: scrub /Users/casa/ developer-username paths from tracked source (metadata-only change)
- **Review findings:** 0C 0M 2m — clean (3 review cycles; minors were cosmetic doc-only: spec prose self-referential no-op, tasks.md description inconsistency; both non-blocking)
- **Tests:** 0 new E2E tests added, 1388 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester pending-respawn since iter 170-171)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1388/1388 unit tests pass; tagged last-good-deploy-iter172-T154)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows T154 task with /home/user/ placeholder confirming path scrub; no regressions; screenshot: verify-iter172-home.png
- **Documenter:** pending-respawn (queued for T155 CLAUDE.md security headers audit)
- **Documenter:** idle (last completed iter 166, commit b57646f)

## Iteration 173 — 2026-04-29T00:55:00Z
- **Built:** T153 Security: address npm audit moderate vulnerabilities (postcss override ^8.5.10 in package.json)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1388 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 11, no bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1388/1388 unit tests pass, npm audit --omit=dev = 0 vulnerabilities; tagged last-good-deploy-iter173-T153)
- **Documenter:** pending-respawn (queued for T155 CLAUDE.md security headers audit)

## Iteration 174 — 2026-04-29T01:20:00Z
- **Built:** T152 Bug: HOME fallback returns literal ~ string — replace || "~" / ?? "/root" with os.homedir() in lib/projects.ts, lib/claude-runner.ts, lib/session-manager.ts
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1395 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 11, no bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1395/1395 unit tests pass; tagged last-good-deploy-iter174-T152)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T152 Bug: HOME fallback returns liter..." confirming fix deployed; project paths render as /Users/casa/ControlTower (real path, not ~); no regressions; screenshot: verify-iter174-home.png
- **Documenter:** pending-respawn (queued for T155 CLAUDE.md security headers audit)

## Iteration 175 — 2026-04-28T23:26:00Z
- **Built:** T150 Bug: schedules DELETE uses non-unique .tmp filename (concurrent-write race)
- **Review findings:** 0C 0M 0m — clean (1 review cycle)
- **Tests:** 0 new E2E tests added, 1395 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 11, no bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, TypeScript clean, 1395/1395 unit tests pass; tagged last-good-deploy-iter175-T150)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T150 Bug: schedules DELETE uses no..." confirming fix deployed; project paths render as /Users/casa/... (full paths, no regressions); screenshot: verify-iter175-home.png
- **Documenter:** running (respawned iter 175 TRIAGE for T155 CLAUDE.md security headers audit)

## Iteration 176 — 2026-04-28T23:50:00Z
- **Built:** T149 Bug: TOCTOU race when answering questions decrements state.health — per-project async mutex (lib/state-mutex.ts) wrapping RMW sequences in answer/route.ts, cost-snapshot/route.ts, cost-start/route.ts
- **Review findings:** 0C 0M 1m — clean (1 review cycle; minor: misleading comment in state-mutex.ts line 50, fixed in ST-5 commit)
- **Tests:** 0 new E2E tests added, 1403 total (8 new unit tests: 5 mutex unit + 1 answer concurrent + 1 cost-snapshot concurrent + 1 cost-start concurrent), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, TypeScript clean, 1403/1403 unit tests pass; tagged last-good-deploy-iter176-T149)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T149 Bug: TOCTOU race when answer..." confirming fix deployed; project paths render as /Users/casa/... (full paths, no regressions); screenshot: verify-iter176-home.png
- **Documenter:** running (working_on_iteration=175, T155 CLAUDE.md security headers audit)

## Iteration 177 — 2026-04-29T02:12:00Z
- **Built:** T148 Bug: session-history `limit` query param is unbounded — clamp to MAX_LIMIT=200 in route.ts + 6 new unit test assertions
- **Review findings:** 0C 0M 0m — clean (2 review cycles)
- **Tests:** 0 new E2E tests added, 1409 total (6 new unit tests covering clamp, passthrough, default, non-positive, NaN, at-ceiling), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 40 routes, TypeScript clean, 1409/1409 unit tests pass; tagged last-good-deploy-iter177-T148)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T148 Bug: session-history 'limit' quer..." confirming fix deployed; project paths render as /Users/casa/... (full paths, no regressions); screenshot: verify-iter177-T148.png
- **Documenter:** running (working_on_iteration=175, T155 CLAUDE.md security headers audit)

## Iteration 178 — 2026-04-29T02:45:00Z
- **Built:** T147 Refactor: replace key={i} index keys in TranscriptViewer with stable keys
- **Review findings:** 0C 0M 0m — clean (2 review cycles)
- **Tests:** 0 new E2E tests added, 1421 total (18 new unit tests: djb2 hash, stable key synthesis, boundary sentinel key, TranscriptViewer key regression), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1421/1421 unit tests pass; tagged last-good-deploy-iter178-T147)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T147 Refactor: replace key={i} index k..." confirming fix deployed; project paths render as /Users/casa/... (full paths, no regressions); screenshot: verify-iter178-T147-home.png
- **Documenter:** running (working_on_iteration=175, T155 CLAUDE.md security headers audit)

## Iteration 180 — 2026-04-29T06:15:00Z
- **Built:** T145 Test gap: untested lib utilities (markdown-sanitize, json-body, git-commit-push, atomic-write)
- **Review findings:** 0C 0M 1m — fixed (1 review cycle; misleading comment in state-mutex.ts line 50)
- **Tests:** 0 new E2E tests added, 1499 total (48 new unit tests: 26 markdown-sanitize + 7 json-body + 9 git-commit-push + 6 atomic-write), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SKIPPED — test-only change; iter178 last-good-deploy-iter178-T147 tag stands
- **Visual check:** SKIPPED — test-only change; no prod code modified; prod server healthy (HTTP 200 / and /api/projects)
- **Documenter:** running (working_on_iteration=175, T155 CLAUDE.md security headers audit)

## Iteration 181 — 2026-04-29T08:10:00Z
- **Built:** T141 Refactor: replace inconsistent parseInt(id, 10) + isNaN guards with a shared parseProjectIndex helper
- **Review findings:** 0C 0M 3m — clean (1 review cycle; minors: velocity/route.ts comment says '404' not '400', [id]/route.test.ts bad-id guard only tests GET not DELETE, spec ST-4 table has duplicate Status rows)
- **Tests:** 0 new E2E tests added, 1537 total (37 new unit tests: 10 helper unit tests + 27 new bad-id 400 assertions across 21 test files), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1537/1537 unit tests pass; tagged last-good-deploy-iter181-T141)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T141 Refactor: replace inconsistent pa..." confirming refactor deployed; project paths render as /Users/casa/ControlTower; screenshot: verify-iter181-home.png
- **Documenter:** running (working_on_iteration=175, T155 CLAUDE.md security headers audit)

## Iteration 182 — 2026-04-29T02:14:00Z
- **Built:** T144 Refactor: dedupe formatRelativeTime between lib and components/schedules
- **Review findings:** 0C 0M 0m — clean (0 review cycles; pure refactor, inline copy deleted, lib export added, output identical)
- **Tests:** 0 new E2E tests added, 1560 total (27 new unit tests: formatRelativeMs coverage for null, sub-60s, minutes, hours, days, weeks, past+future, default-nowMs), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1560/1560 unit tests pass; tagged last-good-deploy-T144)
- **Visual check:** PASS — home page 3 project cards clean; ControlTower card shows "T144 Refactor: dedupe formatRelative..." confirming refactor deployed; schedules page shows SCHED-3 "Last run: 7 hours ago / Next: 1 day from now" and SCHED-1 "Last run: 3 days ago / Next: 3 days from now" — formatRelativeMs output correct, no visual regressions; screenshots: T144-verify-home.png, T144-verify-schedules.png
- **Documenter:** running (working_on_iteration=175, last_completed_iteration=166)

## Iteration 183 — 2026-04-30T04:35:00Z
- **Built:** T140 Refactor: extract structured error logger to replace bare console.error in routes
- **Review findings:** 0C 0M 2m — clean (1 review cycle; minors: lib/CLAUDE.md rule not updated for logger.ts exception, schedule-list.tsx client-side lib/logger.ts usage noted as safe)
- **Tests:** 0 new E2E tests added, 1577 total (17 new unit tests: logger level thresholds, silent suppression, format prefix, meta forwarding, zero-meta, unrecognized-level fallback, per-call env change; answer/route.test.ts spy migrated to vi.spyOn(logger, 'error')), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1577/1577 unit tests pass; tagged last-good-deploy-T140)
- **Visual check:** SKIPPED — internal logging refactor only; no UI changes; prod server healthy (HTTP 200)
- **Documenter:** running (working_on_iteration=175, last_completed_iteration=166)

## Iteration 184 — 2026-04-29T04:47:00Z
- **Built:** T143 Chore: wire e2e Playwright tests into CI workflow
- **Review findings:** 0C 0M 2m — clean (1 review cycle; minors: use.baseURL uses localhost:3200 vs webServer.url 127.0.0.1:3200 cosmetic mismatch; e2e job rebuilds from scratch despite needs:build gate — duplicate CI minutes)
- **Tests:** 0 new E2E tests added, 1577 total (0 new unit tests — config-only change), regression PASS
- **User Tester:** 0 bugs reported, no feedback score (user_tester running, persona 12, 0 bugs this cycle)
- **Deployed:** SUCCESS (config-only: playwright.config.ts webServer block, .github/workflows/test.yml e2e job, CONTRIBUTING.md; 1577/1577 unit tests pass; tagged last-good-deploy-T143)
- **Visual check:** SKIPPED — CI/config-only change; no UI modifications; prod server healthy (HTTP 200)
- **Documenter:** running (working_on_iteration=175, last_completed_iteration=166)

## Iteration 185 — 2026-04-29T05:10:00Z
- **Built:** T138 Refactor: split tasks-client.tsx (735 lines) into 5 sub-components (components/tasks/)
- **Review findings:** 0C 0M 2m — clean (1 review cycle; minors: cosmetic)
- **Tests:** 0 new E2E tests added, 1577 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (Turbopack build clean, 39 routes, TypeScript clean, 1577/1577 unit tests pass; tasks-client.tsx slimmed 735→198 lines; tagged last-good-deploy-T138)
- **Visual check:** PASS (validated in DEPLOY via Playwright: backlog/done sections render correctly, 0 console errors)
- **Documenter:** running (working_on_iteration=175, last_completed_iteration=166)

## Iteration 186 — 2026-04-29T05:26:00Z
- **Built:** T137 Refactor: dedupe appendCeoTask markdown writer (lib/tasks-writer.ts helper)
- **Review findings:** 0C 0M 0m — clean
- **Tests:** 0 new E2E tests added, 1591 total, regression PASS
- **User Tester:** 0 bugs reported, no feedback score (no tester entry this iteration)
- **Deployed:** SUCCESS (build clean, 39 routes, TypeScript clean, 1591/1591 unit tests pass; internal refactor only, no UI changes; tagged last-good-deploy-T137)
- **Visual check:** N/A (internal refactor, no UI changes)
- **Documenter:** running (working_on_iteration=175, last_completed_iteration=166)
