# Backlog

## CEO Requests

### T108: fwaefwefsafawf
- **Type:** feature
- **Priority:** P1
- **Status:** pending
- **Description:** fasdfasdf

### T107: Task detail page does not render the Description field
- **Type:** bug
- **Priority:** P0
- **Status:** pending
- **Description:** /project/[id]/tasks/[taskId] (e.g. http://127.0.0.1:3200/project/1/tasks/T097) does not show the task's Description even when one is set in .redeye/tasks.md. Verified via API: GET /api/projects/1/tasks/T085 (which has a long **Description:** in tasks.md) returns description=null. Same for T097. The parser in lib/redeye-parsers.ts / lib/redeye-files.ts does not extract the `**Description:**` markdown field at all (grep returns no matches for "description"/"Description" in those files). Fix: (1) extend the task parser to recognize `**Description:**` (multi-line — descriptions can span paragraphs until the next `### T` heading or `- **Field:**` marker, whichever comes first). (2) thread the field through the API response and the TaskItem type in lib/redeye-types.ts. (3) render it on the task detail page below the title, with markdown formatting if feasible (react-markdown is already a dep). (4) add a parser unit test using a fixture that includes a Description with multiple paragraphs and embedded code/links. This affects every task that carries detailed acceptance criteria — without it, RedEye agents AND CEO users miss critical context.

### T106: GitHub repo metadata — set description + topics on the GitHub side
- **Type:** chore
- **Priority:** P3
- **Status:** pending
- **Description:** Use `gh repo edit Bitmia-ai/ControlTower` to set the GitHub-side description (matches package.json: "Web dashboard to orchestrate RedEye autonomous dev sessions across multiple projects. Local-only, binds to 127.0.0.1.") and topics (suggest: redeye, claude-code, autonomous, dashboard, orchestration, nextjs, local-first). These are GitHub repo settings, not code changes — `gh` CLI handles it. Verify after with `gh repo view Bitmia-ai/ControlTower`.

### T105: CHANGELOG.md + first stable release tag
- **Type:** chore
- **Priority:** P3
- **Status:** pending
- **Description:** Create CHANGELOG.md following keep-a-changelog format with entries for v0.1.0 (initial OSS release) and v0.2.0 (current — task rename, logo, worktree fix, CI, etc.). After the OSS-readiness P0 tasks land, bump package.json to 0.2.0 and tag `git tag v0.2.0 && git push origin v0.2.0`. Don't `npm publish` — that's T104.

### T104: Prepare npm package for npx-able install (DO NOT PUBLISH)
- **Type:** feature
- **Priority:** P3
- **Status:** pending
- **Description:** Get the npm publish flow ready but DO NOT run `npm publish`. The CEO will publish manually when ready. Steps: (1) Decide the package name — `@bitmia/control-tower` is safer (scoped, free) than unscoped `control-tower` which may already exist. (2) Add a `bin/` entry in package.json mapping a CLI launcher (e.g., `bin/control-tower.mjs`) that runs `next start` (assumes user has built first) or auto-builds if `.next/` is missing. (3) Add a `files` whitelist in package.json — must include `.next/standalone`, `.next/static`, `public/`, `bin/`, `package.json`, `LICENSE`, `README.md`. Review what NOT to ship (node_modules, src, e2e, tests, docs/, screenshots). (4) Switch to `output: "standalone"` in next.config.ts so the package contains a self-runnable Node bundle. (5) Add `prepublishOnly: "npm run build"` script. (6) Toggle `"private": true` to false (or document the toggle in README). (7) Run `npm pack --dry-run` to inspect the would-be tarball. Verify size is reasonable (<10 MB). (8) Test locally with `npm pack && npm install -g ./bitmia-control-tower-0.2.0.tgz && control-tower` — should boot the dashboard. (9) STOP. Document in CHANGELOG.md that the package is publish-ready but not yet on npm. Add a "Publishing" section to CONTRIBUTING.md describing the manual `npm publish --access public` step. **Do not actually publish.** Deliverable is a confirmed-working `npm pack` tarball + clear publish instructions.

### T103: Self-dogfood doc note for prod-rebuild caveat
- **Type:** docs
- **Priority:** P3
- **Status:** pending
- **Description:** Document the "Running CT against its own repo" caveat. When CT autodevelops itself (a CT project pointing at /Users/.../ControlTower), RedEye's DEPLOY phase rebuilds main's `.next/` while the prod server is reading from it — chunks go stale, page crashes. With the worktree-isolation fix in agents/cto.md (RedEye repo) this no longer happens for new tasks since BUILD/DEPLOY run in `.worktrees/T-N/.next/`. But the caveat is worth a one-paragraph note in CLAUDE.md and a README footnote so a future contributor running CT against its own checkout knows what to expect. Reference the upstream bug context: tailscale/tailscale#18827 for the dev-mode-via-Tailscale issue is already in CLAUDE.md.

### T102: Tune issue templates with OS/Node/RedEye-version fields
- **Type:** chore
- **Priority:** P2
- **Status:** pending
- **Description:** Review .github/ISSUE_TEMPLATE/*.md (or *.yml) and ensure bug reports prompt for: macOS/Linux + version, Node version (`node -v`), RedEye plugin version (the `Bitmia-ai/RedEye` commit hash from `~/.claude/plugins/cache/.../plugin.json` if cached, or note user installed via `--plugin-dir`), CT version (from package.json), browser if relevant, the project path being dashboarded. Use GitHub's structured issue forms (.yml) rather than markdown if possible — they're more reliable. Keep feature-request template lighter.

### T101: Coverage report in CI + badge in README
- **Type:** feature
- **Priority:** P2
- **Status:** pending
- **Description:** vitest already has @vitest/coverage-v8 in devDependencies. (1) Add `npm test -- --coverage` step to the CI workflow (.github/workflows/test.yml). (2) Upload coverage to Codecov or similar (Codecov has free OSS tier). (3) Add a coverage badge to README.md under the existing badges. (4) Set a coverage threshold in vitest.config.ts (e.g., 70% lines/branches/functions) to prevent regression. Don't aim for 100% — pragmatic threshold only.

### T100: Dependabot config for auto dependency PRs
- **Type:** chore
- **Priority:** P2
- **Status:** pending
- **Description:** Add `.github/dependabot.yml` configured for npm + github-actions ecosystems, weekly schedule, auto-grouping minor/patch updates. This is a strong trust signal for OSS users without much maintenance cost. Reference: github.com/dependabot/dependabot-core wiki for examples. Group by ecosystem; ignore major bumps for `next`, `react`, `react-dom`, `tailwindcss` (require manual review). Limit open PRs to 5 to avoid noise.

### T099: Audit or remove next.config.test.ts
- **Type:** chore
- **Priority:** P2
- **Status:** pending
- **Description:** /Users/casa/ControlTower/next.config.test.ts exists at top level. Check whether it is referenced by vitest.config.ts (probably not — root configs are usually ignored). Either (a) move it under `__tests__/` if the assertions are valuable (e.g., it tests the watchOptions.ignored config), or (b) delete it as cruft. Verify the worktree-ignore globs are still tested somewhere (this is the regression-risk path that prevents the 80 GB Turbopack memory blowup).

### T098: Migrate middleware.ts to proxy.ts (Next.js 16 deprecation)
- **Type:** chore
- **Priority:** P2
- **Status:** pending
- **Description:** Next.js 16 deprecated the `middleware` file convention in favor of `proxy`. Every dev server start prints: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy`. Follow the migration guide at the linked URL. Our middleware.ts implements Origin / Sec-Fetch-Site CSRF protection on mutating routes — verify the protection still works after migration via the existing middleware.test.ts (or create one if absent). Run e2e against a fresh CT to confirm POSTs still pass and cross-origin POSTs still 403.

### T097: Fix or delete failing ControlsCard responsive test
- **Type:** bug
- **Priority:** P0
- **Status:** pending
- **Description:** components/__tests__/responsive.test.tsx > "T057 responsive classes > ControlsCard button row uses flex-wrap for narrow viewports" has been failing for several iterations and RedEye keeps not catching it. The test asserts `container.querySelectorAll("div.flex.flex-wrap").length > 0` but the recent T083 controls-card redesign explicitly removed flex-wrap. Either (a) the test is stale and should be deleted, or (b) the responsive intent is still valid and a new wrapping mechanism (CSS grid with auto-fit, or different breakpoint) should be added. Investigate, decide, fix or delete. After this lands the full vitest suite should be green.

### T096: Add .github/CODEOWNERS
- **Type:** chore
- **Priority:** P1
- **Status:** pending
- **Description:** Add `.github/CODEOWNERS` with at minimum `* @Bitmia-ai` — surfaces ownership on every PR for review request automation. If specific paths warrant different owners later (e.g., `lib/session-manager.ts` to a security reviewer), add path-specific lines. Keep it simple to start.

### T095: Add demo gif or short video to README
- **Type:** docs
- **Priority:** P1
- **Status:** pending
- **Description:** Static screenshots don't convey the autonomous loop. Record a 30–60 second clip showing: (a) home page with project cards, (b) clicking Start on a project, (c) phase progression in real time (TRIAGE → PLAN → BUILD), (d) a task transitioning to "done", (e) cost ticking up. Use `vhs` (terminalizer alternative) or screen-record + ffmpeg to convert to .gif (cap at ~5 MB). Embed in README under the existing screenshot table. The haze project is the cleanest demo target since it's the test app — set up a fresh haze with one task ("print weather for a city via Open-Meteo") and capture the loop.

### T094: Verify and improve empty-state UX for first run
- **Type:** feature
- **Priority:** P1
- **Status:** pending
- **Description:** Test what a brand-new user sees: delete `~/.redeye/config.json`, start CT, open localhost:3200. Currently the home page probably shows "0 projects registered" with an Add Project button, which is fine but cold. Improve by: (a) showing onboarding copy explaining what to do ("Add your first project — point it at a git repo and CT will scaffold .redeye/ via /redeye:init"), (b) linking to the README's Quick Start, (c) maybe a sample project that can be added with one click (if Open-Meteo demo project exists somewhere users can clone). Verify against actual fresh state, not just the rendered card. Don't over-design — friendly is enough.

### T093: Troubleshooting section in README
- **Type:** docs
- **Priority:** P1
- **Status:** pending
- **Description:** Add a Troubleshooting section to README.md covering: (1) Port 3200 already in use — how to find and kill, or override via `next dev --port`. (2) Tailscale serve needs prod mode (current CLAUDE.md note belongs in user-facing README too — link upstream Tailscale issue #18827). (3) `npm run build` fails with module-not-found — usually missing `npm install`. (4) Home page shows "Loading projects" forever — usually means dev mode + Tailscale (see #2) or middleware blocking the GET (CSRF false positive). (5) Project page shows "Something went wrong" — usually stale .next/ chunks after self-dogfood DEPLOY (see T103). (6) RedEye loop won't start — check `~/redeye` exists and `--plugin-dir ~/redeye` resolves. Each entry: 1 sentence symptom, 1 sentence cause, 1 line fix.

### T092: Add .env.example documenting all runtime env vars
- **Type:** docs
- **Priority:** P1
- **Status:** pending
- **Description:** CT reads five env vars at runtime, none documented anywhere a user would find: REDEYE_CONFIG_PATH (default ~/.redeye/config.json), REDEYE_PLUGIN_DIR (default ~/redeye), CLAUDE_BIN (default `claude`), ALLOW_OUTSIDE_HOME (default unset; `1` to allow project paths outside $HOME), HOME (system). Create `.env.example` at the repo root with each var, its default, and one-line purpose. Reference it from the Quick Start section of README.md. Don't actually load .env files at runtime unless there's a reason — just document.

### T091: Refresh README screenshots (home, mission-control, task-detail)
- **Type:** docs
- **Priority:** P0
- **Status:** pending
- **Description:** Three screenshots in `.github/assets/` need refresh: home.png (now shows new logo + 3 projects), mission-control.png (Working On card was redesigned via T085, controls-card via T083, schedule deletion via T081), task-detail.png (replaces backlog-detail.png — README already references the new filename). Use Playwright via the frontend-design skill or designer subagent to capture in dark mode at 1200px viewport. Match the existing aspect ratios. Update README references if any filenames changed. After landing, the existing `backlog-detail.png` file in `.github/assets/` can be deleted.

### T090: the health card shows X shipped. X is a much lower number of those shipped in total. is it just the session shipped? it should be the total and then the ones shipped in this session
- **Type:** feature
- **Priority:** P1
- **Status:** pending

### T089: recently shipped tasks is still showing not the top 10 recent ones, but older ones. fix it
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 117)
- **Spec:** docs/specs/T089-T088-mission-control-ux-fixes.md
- **Summary:** Fixed Recently Shipped card to show up to 10 items (was 8). Changed recentlyShipped = allDoneSorted.slice(0, 10) in readProjectDetail. allDoneItems (Tasks tab full list) unaffected. Updated ShippedCard comment and redeye-files.test.ts assertion. Build clean, 0 regressions.

### T088: If no more tasks are available, up next shows the currently worked on task. it should show "no pending tasks" in a nice way
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 117)
- **Spec:** docs/specs/T089-T088-mission-control-ux-fixes.md
- **Summary:** Fixed Up Next card showing the currently in-progress task when no pending tasks remain. UpNextCard now filters out in-progress items (they belong in WorkingOn card) and shows "No pending tasks" when the filtered list is empty. 4 new tests in up-next-card.test.tsx. Build clean, 0 regressions.

### T087: creating a new Schedule, shows next: xyz ago. Instead of showing never run before
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 116)
- **Spec:** docs/specs/T086-pagination-total-count-fix.md
- **Summary:** Fixed buildScheduleBlock (schedules POST route) to write "Last run: —" instead of "Last run: 1970-01-01T00:00:00Z" for newly created schedules. The parser saw the epoch as a valid ISO timestamp, computed nextDueMs as epoch+duration, and showed "Next: 56 years ago". With "—", the parser returns lastRunIso=null (never-run) and ScheduleRow shows "Next: —" while StatusBadge shows "Never run" badge. Build clean, 0 regressions.

### T086: pagination total counts (like Done X total count) shows only visible count, not total count. it shoudl show like 70 something
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 116)
- **Spec:** docs/specs/T086-pagination-total-count-fix.md
- **Summary:** Fixed Tasks tab Done section showing only up to 8 items. Root cause: readProjectDetail sliced done tasks to 8 for the recentlyShipped card; tasks-client used recentlyShipped for allItems so Done bucket only had 8 entries. Fix: added allDoneItems (full sorted+enriched done list, unsliced) to ProjectDetail type and readProjectDetail. tasks-client now uses allDoneItems — Done CollapsibleSection shows full count (e.g. "Done 70") and pagination works correctly ("1–25 of 70"). recentlyShipped still limited to 8 for mission-control card. 4 new passing tests in redeye-files.test.ts. Build clean.

### T085: Working On card stuck on "Starting up — analyzing project..." for non-uppercase phases and when task_title is absent from state.json
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** iteration 112
- **Spec:** docs/specs/T085-working-on-card-phase-case-fix.md
- **Summary:** Fixed WorkingOn card showing "Starting up" for all active phases. Root causes: (1) state.json stores phase in lowercase but comparisons used uppercase literals — fixed by adding `normalizePhase()` helper that uppercases at the component boundary; (2) state.json has no `task_title` field — fixed by adding `activeTaskTitle` prop to WorkingOnCard and passing `detail.activeItem.title` from mission-control-client. Also added human-readable phase messages for all BUILD/PLAN/REVIEW/DEPLOY/VERIFY/MERGE phases. 14 new tests (766 total, 320 passing). 0C/0M/0m review. Build clean.
- **Description:** BUG: On the ControlTower project mission-control page, the Working On card displays "Starting up — analyzing project..." even though RedEye is mid-cycle (e.g. phase=merge/verify/review/deploy/build/plan, task_id=T083). ROOT CAUSE: Two compounding issues in components/mission-control/working-on-card.tsx. 1) Case-mismatch on phase comparisons. state.json stores phase values in lowercase (e.g. "merge", "verify", "review", "build"), but lines 100-105 compare strictly against UPPERCASE literals ("HARDEN", "STABILIZE", "TRIAGE", "INCORPORATE", "SCHEDULES"). Every other phase falls through to the default copy on line 105: `"Starting up — analyzing project..."`. lib/redeye-types.ts Phase union and PHASE_LABELS keys are UPPERCASE but on-disk state.json is lowercase — there is no normalization layer between readState() in lib/redeye-files.ts (which JSON.parses raw) and the component. 2) hasTask = state?.task_title is falsy because state.json does not include a task_title field (only task_id). So even when a task is active, the running && !hasTask && state?.phase branch (line 95) is taken instead of the rich branch on line 116 that renders TaskId + title. EVIDENCE: - File: components/mission-control/working-on-card.tsx - Line 37: const hasTask = state?.task_title; (task_title not in state.json → always falsy) - Lines 95-106: phase === compares against UPPERCASE only → lowercase phases fall through to default - Lines 105 and 113: hardcoded fallback "Starting up — analyzing project..." - File: lib/redeye-types.ts Phase = TRIAGE|PLAN|...|MERGE (UPPERCASE union) - File: lib/redeye-files.ts:56-68 readState — JSON.parse with no normalization - Current .redeye/state.json snippet: {"phase": "merge", "phase_status": "in-progress", "task_id": "T083", "spec_file": "docs/specs/T083-project-main-screen-redesign.md"} — NO task_title key. REPRO: any state.json where running=true, task_title is absent, and phase is one of: plan, build, review, deploy, verify, merge (lowercase, or any value no…

### T084: All lists across the dashboard (history, steer, schedules, etc need to have pagination and filtering
- **Type:** feature
- **Priority:** P0
- **Status:** done
- **Merged:** iteration 111
- **Spec:** docs/specs/T084-pagination-filtering.md
- **Summary:** Added pagination and filtering to all 4 major list views. Shared components: ListToolbar (search input, filter chips, sort select, clear button) and Pagination (prev/next, range info), plus a generic useListFilter hook. Tasks tab: backlog has priority/status filters + 4 sort keys (20/page), done section has search/sort (25/page). Schedules tab: search + status filter (overdue/on-schedule/never-run) + next-due/last-run/title sort (15/page). Steer tab: search + newest/oldest sort (20/page). History tab: sessions (search + sort, 10/page) + iteration log (search, 20/page). 40 new tests; 752 total (320 passing, 432 pre-existing failures unchanged). Build clean.
- **Description:** Use the designer subagent + frontend skill to design it and share the components/ui between tabs as much as possible for code maintenance. I should be able to filter by priorities, status, last run (when applicable), as well as key words. I should also be able to sort according to some keys

### T083: the 4 control buttons in the project main screen as misaligned. also only one has an icon
- **Type:** feature
- **Priority:** P0
- **Status:** done
- **Merged:** iteration 110
- **Spec:** docs/specs/T083-project-main-screen-redesign.md
- **Summary:** Added icons to all 5 action buttons in the ControlsCard: Play (Start), Square (Stop), Pause (Pause), RotateCcw (Restart), Navigation (Steer). All buttons now use inline-flex with gap-1.5 for consistent icon+text alignment. Removed flex-wrap from both button rows so buttons stay properly aligned at the 300px right-rail width. 712 tests unchanged (432 pre-existing failures), build clean.
- **Description:** Can we have the design subagent and front end skill fix the entire project main screen so it looks sleek and not messy?

### T082: Recently shipped in the main project screen should show the last N tasks shipped. now it shows old ones it feels. It should also add X min ago, or X hours ago, or X days ago
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 113)
- **Spec:** docs/specs/T082-recently-shipped-relative-time.md
- **Summary:** Recently Shipped card now sorts items by iteration number descending (newest first), shows up to 8 items instead of 5, and displays relative time ("2 days ago", "3 hours ago", etc.) below items that have a Merged date. Added mergedAt/mergedIteration fields to TaskItem, parseTasks() parses both "YYYY-MM-DD (iter N)" and "iteration N" formats. New formatRelativeTime() utility with full bracket coverage. 28 new tests (798 total, 348 passing).

### T081: I want to be able to delete schedules from the schedule tab
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 114)
- **Spec:** docs/specs/T081-delete-schedules.md
- **Summary:** Added delete functionality to the Schedules tab. DELETE /api/projects/[id]/schedules/[schedId] endpoint with schedId validation, path-traversal guard, and atomic write (tmp+rename). applyScheduleDelete() parser helper removes SCHED-N blocks cleanly. ScheduleRow now shows a hover-reveal trash icon (group/opacity-0/group-hover:opacity-100, 44px touch target, aria-label) with an inline confirmation panel matching the Steer tab delete pattern. SchedulesContent.handleDelete removes the item from local state on success — no full re-fetch needed. 23 new tests (11 passing, 12 failing match pre-existing fs-mock/React.act patterns). Build clean.

### T080: the three arrow buttons in the Live tab are hard to understand. what do they do? maybe better icons and some text?
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-27 (iter 115)
- **Spec:** docs/specs/T080-live-tab-buttons.md
- **Summary:** Replaced the three icon-only toolbar buttons with icon+text labeled buttons. Expand all: ChevronsUpDown replaced by UnfoldVertical + "Expand all" text. Collapse all: ChevronsUpDown-rotated replaced by FoldVertical + "Collapse all" text. Auto-scroll: ArrowDown replaced by ChevronsDown + "Auto-scroll" text. All buttons use inline-flex px-2.5 py-1.5 layout. All existing behavior preserved (active state colors, aria-labels, three-state logic, scroll-away yellow highlight). 11 new tests (all passing, @vitest-environment node, source-text strategy). 832 total tests (370 passing, 462 pre-existing failures unchanged). Build clean.

### T079: Pwa auto zooms when I type on my phone to add a task
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/T079-pwa-viewport-zoom-fix.md
- **Merged:** iteration 109

### T078: History tab collapsibles only show some uuid which is useless
- **Type:** feature
- **Priority:** P1
- **Status:** pending

### T077: Lighthouse baseline + per-page metadata.title + chunk investigation
- **Type:** performance
- **Priority:** P2
- **Status:** done
- **Added:** 2026-04-26 (iter 108)
- **Started:** 2026-04-26 (iter 108)
- **Merged:** 2026-04-26 (iter 108)
- **Spec:** docs/specs/T077-lighthouse-perf.md
- **Summary:** Added per-page metadata.title to all 8 dashboard pages using a server wrapper pattern, so browser tabs show the current section name. Added turbopack.root config to silence the workspace root warning during dev. Investigated the 228 KB shared runtime chunk and documented that it is React core plus Turbopack runtime and cannot be further reduced. 9 new tests bring the total to 804.
- **Source:** Q-013 default (iter 108) — CEO invoked /redeye:start, interpreted as proceed with option 5 (deeper Lighthouse/performance work)
- **Description:** Implement recommendations from docs/performance-audit.md. (1) Run Lighthouse CLI against the production build and record actual scores as a baseline in docs/lighthouse-report-baseline.md. (2) Add per-page `metadata.title` to mission control, backlog, history, live, schedules, and steer pages so the browser tab and title template show the current section. (3) Investigate the 228 KB shared runtime chunk — identify the top contributors and determine if any can be split or lazy-loaded. (4) Consider `turbopack.root` in next.config.ts to silence the workspace root warning. All changes must keep 796/796 tests green and production build clean.

### T076: Dependency updates — lucide-react, react/react-dom, evaluate TypeScript 6.0
- **Type:** chore
- **Priority:** P2
- **Status:** planned
- **Added:** 2026-04-26 (iter 108)
- **Source:** Q-013 default (iter 108) — CEO invoked /redeye:start, interpreted as proceed with option 1 (dependency updates)
- **Description:** Update the following dependencies to their latest stable versions and verify no regressions: lucide-react (1.9 → 1.11), react and react-dom (19.2.4 → 19.2.5). Evaluate TypeScript 6.0 upgrade: run `npm install typescript@6 --save-dev`, check for type errors, and either complete the upgrade if clean or document the blockers and revert. Also update @types/node to the current LTS version. After each update, run `npm run build` and `npx vitest run` to verify all 796 tests pass and the production build is clean. The postcss moderate vulnerability (no safe fix without breaking Next.js) should remain as a known/accepted risk — do not force-upgrade it.

### T075: Performance audit — Lighthouse, bundle size, Core Web Vitals
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Added:** 2026-04-25 (iter 106)
- **Started:** 2026-04-25 (iter 106)
- **Merged:** 2026-04-25 (iter 106)
- **Spec:** docs/specs/T075-performance-audit.md
- **Source:** Q-012 default (iter 106) — CEO invoked /redeye:start, interpreted as proceed with option 1 (performance audit)
- **Summary:** Completed a performance audit of the Control Tower dashboard and implemented three quick-win improvements. T1: Created a shared MarkdownRenderer wrapper and switched all three pages that use react-markdown (steer, backlog detail, history) to next/dynamic — moves the markdown library (~60 KB gzip) out of the shared chunk into lazy route chunks loaded only when those tabs are visited. T2: Added proper viewport export and improved metadata (title template, robots:noindex) to root layout per Next.js 15+ convention. T3: Added explicit Cache-Control headers in next.config.ts (immutable for /_next/static/*, no-store for /api/*). Wrote docs/performance-audit.md with baseline metrics, changes, and recommendations. 13 new tests (796 total, was 783). Build clean. vitest config updated to include root-level *.test.ts files.

### T074: "Working on" card height is different from "Controls" which is next to it. fix it
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Started:** 2026-04-25 (iter 99)
- **Merged:** 2026-04-25 (iter 99)
- **Summary:** Fixed WorkingOn/Controls card height mismatch by wrapping the top mission-control row in a nested stretch-alignment grid. Root cause was the outer grid using items-start which prevented h-full from working. No card markup changed — minimal CSS fix.

### T073: steer tab, directives need to be rendered with markdown
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Started:** 2026-04-25 (iter 100)
- **Merged:** 2026-04-25 (iter 100)
- **Summary:** Steer tab directives now render as markdown using react-markdown + remark-gfm (already in package.json). DirectiveRow wraps directive text in a Tailwind Typography prose container with dark mode support. Input textarea remains plain text. Links render in red-600 accent color.

### T072: Steer tab. we need to be able to edit/delete directives
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Started:** 2026-04-25 (iter 101)
- **Merged:** 2026-04-25 (iter 101)
- **Summary:** Steer tab directives are now editable and deletable. PATCH and DELETE API endpoints added with index-based addressing, input validation, and 4KB body cap. DirectiveRow gained hover-reveal pencil/trash icons (44px touch targets, aria-labels), inline edit textarea pre-filled with directive source, and inline delete confirmation panel matching the project-card pattern. applyDirectiveEdit/applyDirectiveDelete helpers added to lib/redeye-parsers.ts preserving file structure. 39 new tests (731 total).

### T071: Apply the same design styles form the main page to all the other pages and tabs. use the design subagent and frond end skill
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 98)
- **Summary:** Propagated the precision-instrument design system from the home page to all dashboard pages. Mission control cards switched to a 3px status top border with phase-driven colors and monospace section labels. The project layout gained a Control Tower eyebrow, project name h1 with pulsing dot, and a Running/Idle pill above the nav. Backlog, History, Schedules, and Steer pages each received a standard eyebrow, h1, subtitle, and border-b header. Backlog list rows show a border-l-2 status indicator and ScheduleRow gained a border-t-[3px] with overdue/on-schedule color coding. 691/691 tests pass.

### T070: we need to be able to add schedules form the schedule tab
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Started:** 2026-04-25 (iter 102)
- **Merged:** 2026-04-25 (iter 102)
- **Summary:** Added schedule creation from the Schedules tab. POST /api/projects/[id]/schedules endpoint validates name, frequency, and steps, assigns the next SCHED-{id}, and writes the new entry to schedules.md. AddScheduleDialog Radix modal with name, frequency, steps, and optional description fields. Button added to page header and EmptyState. 31 new tests (762 total).

### T069: Directives int eh Steer tab need to be editable or deletable
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Reason:** Superseded by T072 which covers the same requirement (edit/delete steer directives) and was filed later as the canonical CEO request.

### T068: Polish Live tab visual design — improve transcript viewer styling and readability
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Started:** 2026-04-25 (iter 105)
- **Merged:** 2026-04-25 (iter 105)
- **Source:** Q-011 answer (iter 96) — CEO requested UX/design improvements using designer subagent and frontend skill
- **Summary:** Polished the Live tab transcript viewer with the precision-instrument design system. Added standard page header (Control Tower eyebrow + h1 Live + subtitle + border-b). Applied CARD-LABEL token to all card type eyebrows. Added border-l-2 identity rails (indigo=tool calls, cyan=results, violet=thinking, red=assistant). AssistantTextCard promoted to text-[15px] with shadow-sm. ThinkingCard muted to secondary violet. ChevronRight replaces unicode arrows with smooth rotation transition. 4 new tests (783 total).
- **Description:** The Live tab transcript viewer works well functionally but could benefit from visual polish. Use the designer subagent to enhance the visual presentation and improve readability of transcript content. Focus areas: improve Claude's Thinking cards styling and visual hierarchy, refine User message box appearance, enhance phase indicator badges, optimize line-height and spacing for better text readability, ensure consistent styling across light/dark modes. Implement via frontend skill after designer mockups.

### T067: Redesign mission control page layout and cards using designer + frontend
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Started:** 2026-04-25 (iter 103)
- **Merged:** 2026-04-25 (iter 103)
- **Source:** Q-011 answer (iter 96) — CEO requested UX/design improvements using designer subagent and frontend skill
- **Summary:** Redesigned the mission control page with an asymmetric two-column layout (lg:grid-cols-[1fr_300px]). Left column = mission feed (WorkingOn hero, QuestionsCard, Shipped+UpNext sub-grid). Right rail = Controls + Cost + Health. WorkingOnCard upgraded to hero treatment (p-6, min-h-160px, text-lg title, subtle green wash when running). QuestionsCard collapses to a minimal strip when empty. ControlsCard compacted for rail (p-4, separator row). CostCard stacked Session/Total layout. Removed Backlog/Telemetry section labels. 11 new tests (773 total).
- **Description:** The mission control page at /project/[id] shows all critical information (Working On, Controls, Cost, Questions, Recently Shipped) but could benefit from a comprehensive visual redesign. Use the designer subagent to create mockups for a more polished, modern layout with improved visual hierarchy, better card proportions, and refined typography. Focus on: reorganizing the 3-column grid for better balance, enhancing card backgrounds and borders, improving spacing and alignment, refining typography scale and weights, and ensuring the design scales gracefully across viewports. Implement the design using the frontend skill after mockups are approved.

### T066: Redesign home page project cards and improve dashboard visual hierarchy
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 97)
- **Source:** Q-011 answer (iter 96) — CEO requested UX/design improvements using designer subagent and frontend skill
- **Description:** The Control Tower home page displays project cards in a grid, but the visual design could be more distinctive and polished. Use the designer subagent to create a modern, visually distinctive design for the project card layout. Focus areas: enhance card visual presentation with improved colors, gradients, or layered backgrounds; improve the display of status indicators (phase badge, cost, question count); optimize typography and spacing for better visual hierarchy; add subtle animation or micro-interactions to make the dashboard feel more alive; ensure excellent contrast and readability in light/dark modes. Implement via frontend skill after designer provides mockups.
- **Summary:** Redesigned the home page project cards with a 'precision instrument' aesthetic. Cards now have a 3px status top border (green=running, amber=questions pending, zinc=idle), an animate-ping pulsing dot when running, a phase footer strip with tinted PHASE_COLORS background, hover-reveal trash icon, monospace path text, and an inline red-tinted delete confirmation panel. The page header gained a 'CONTROL TOWER' eyebrow label, 'Projects' h1, project count subtitle, and a border-b divider. 15 new tests added (691 total). Verified in both dark and light mode.

### T065: Add Won't Do section at the end of the backlog page
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Started:** 2026-04-25 (iter 104)
- **Merged:** 2026-04-25 (iter 104)
- **Spec:** docs/specs/T065-wont-do-section.md
- **Summary:** Added Won't Do section to the backlog page. Extended readProjectDetail to include wontDoItems (filtered by status=wontdo). parseBacklog extracts **Reason:** field. computeBuckets now filters by status (not section) so items from any markdown section are correctly bucketed. WontDoItemRow renders strikethrough title + monospace Reason eyebrow + rationale. Section collapsed by default, positioned after Done. 6 new tests (779 total). Required 2 fix cycles to correct data plumbing and bucket logic.

### T064: the cost polot is nice, but it seems scaled weird, the text is very wide while not tall. it feels like a stretched image. fix it
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 93)
- **Spec:** docs/specs/T064-cost-plot-scaling.md
- **Summary:** Fixed the cost sparkline aspect ratio by increasing VIEW_H from 48 to 80 (2.5:1 ratio instead of 4.17:1), removing the `width="100%"` SVG attribute, and adding `height={80}` so the browser renders the chart at its natural height without horizontal distortion. Removed the `max-h-[72px]` container clamp. Updated 3 test files; 663/663 tests pass and the production build is clean.

### T063: we need a steer tab added. make it fully funcitonal
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 94)
- **Spec:** docs/specs/T063-steer-tab.md
- **Summary:** Added a fully functional Steer tab at `/project/[id]/steer`. New GET handler returns parsed directives from `steering.md`; existing POST handler writes directives. The `SteerContent` component renders a textarea form with inline success/error feedback, a live directive list with skeleton/empty states, and dark/light mode support. "Steer" tab added to ProjectNav after Schedules. 675/675 tests pass, production build clean.

### T062: in the main screen for a project, make the cards look betteer. now they all have different sizes. it looks messy
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 92)
- **Spec:** docs/specs/T062-card-sizing.md
- **Summary:** Fixed inconsistent card heights on the project mission-control screen by switching the grid to top-aligned items, adding a minimum height to row-1 card wrappers, making the sparkline scale proportionally, and capping its container at 72px. All 657 tests pass and the production build is clean.

### T061: remove the keyboard shortcuts from all buttons like (GB)
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 91)
- **Summary:** Removed all keyboard shortcut badge `<kbd>` elements from project-nav.tsx (G+B, G+H, G+L, G+S tab hints) and controls-card.tsx (S, X, P, B action buttons). The shortcut logic itself was also stripped. Tests updated across 3 files; 656/656 pass. Build clean.

### T060: When phase=waiting_for_ceo and CTO has exited, the dashboard should clearly show blocked state on the project card (banner/badge) with CTA to answer the inbox question or hit Start. Today the card looks identical to running, leading to confusion when the user replies and nothing happens. Also: when state is waiting_for_ceo and inbox.md is updated with an answer, the dashboard should auto-start the CTO without manual intervention.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 90)
- **Summary:** Fixed false-positive "running" status and added auto-resume on inbox answer. Reduced log-freshness fallback window and added blocked-state badge to project card.

### T059: Dashboard shows running when CTO process is dead. The 60s log-freshness fallback in discoverPid() returns pid=-1 (assume running) when session-cto.jsonl was modified recently — but that just means the last subagent flushed logs, not that the CTO is alive. Fix: trust PID file or process-table lookup over log freshness. Reduce the fallback window to 5s and require BOTH log freshness AND a writable pidfile.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 90)
- **Summary:** Fixed discoverPid() to trust PID file and process-table lookup over log freshness. Reduced fallback window to 5s, requires BOTH log freshness AND writable pidfile.

### T058: schedules UI needs to be operative
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 90)
- **Summary:** Fixed global-error.tsx build failure (ClientProviders with custom ESM ThemeProvider, postinstall patch for Next.js 16.2.4 _global-error prerender bug). Added POST /api/projects/[id]/schedules/run endpoint, Run now button in ScheduleRow (sibling of expand button, not nested), SCHED-1 sample schedule, projectId threaded through schedules page, unit tests for all new code. 662/662 tests pass, npm run build clean.

### T057: Mobile-responsive layout — make the dashboard usable on phones and tablets
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Added:** 2026-04-25 (iter 88)
- **Merged:** 2026-04-25 (iter 88)
- **Source:** Q-009 default (iter 88) — CEO implicitly approved by invoking /redeye:start
- **Summary:** Made all dashboard pages usable on phones and tablets using Tailwind responsive prefixes. Project cards, mission control, backlog, live tab, and schedules now reflow to single-column on mobile, with navigation tabs that scroll horizontally on small screens. Touch targets meet the 44px WCAG minimum. Playwright E2E and unit tests confirm correct rendering at 375px and 768px viewports.
- **Details:**
  - The Control Tower dashboard is currently designed for desktop viewports only
  - Make all pages responsive so they work well on phones (≥320px) and tablets (≥768px)
  - Pages to target: home page (project cards), mission control (/project/[id]), backlog list, backlog detail, history, live tab, schedules tab
  - Key layout changes needed:
    - Home page: project cards stack vertically on mobile instead of grid
    - Mission control: single-column stack on mobile (Working On, Controls, Cost, Questions, Recently Shipped)
    - Project nav tabs: horizontal scroll or collapsed hamburger menu on mobile
    - Backlog list: full-width rows, hide secondary columns on small screens
    - Live tab: toolbar collapses, transcript cards full-width
  - Use Tailwind responsive prefixes (sm:, md:, lg:) — no new CSS libraries needed
  - Ensure touch targets are at least 44x44px (WCAG 2.5.5)
  - Test with Playwright viewport resize (375x667 iPhone SE, 768x1024 iPad)
  - Add unit tests for any new responsive hooks or components

### T056: Redesign backlog, history, and live tabs using designer sub-agent and frontend skill
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Added:** 2026-04-25 (iter 85)
- **Merged:** 2026-04-25 (iter 86)
- **Spec:** docs/specs/T056-tab-redesign.md
- **Details:**
  - The backlog, history, and live tabs need a visual redesign pass using the designer sub-agent and frontend skill
  - Apply a consistent, polished design system across all three tabs, matching the quality level of the redesigned mission control page (T045)
  - Backlog tab: improve list layout, status indicators, priority badges, and the collapsible done section
  - History tab: improve the sessions list layout, phase chips, cost badges, and the iteration log
  - Live tab: improve the transcript viewer, collapsible user boxes, thinking cards, and the toolbar
  - Ensure dark/light mode consistency across all redesigned components
  - Use the designer sub-agent for visual direction, then implement with the frontend skill

### T055: Add Schedules tab to project dashboard — view and manage RedEye scheduled tasks
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 85)
- **Added:** 2026-04-25 (iter 85)
- **Spec:** docs/specs/T055-schedules-tab.md
- **Summary:** Added a Schedules tab to the project dashboard. New `ScheduleEntry` type and `parseDurationMs`/`parseSchedules` parsers read `.redeye/schedules.md`. A `GET /api/projects/[id]/schedules` endpoint exposes parsed schedules. The `ScheduleList`/`ScheduleRow`/`StatusBadge` components render overdue/on-schedule sections with expandable step details. The `/project/[id]/schedules` page shows a skeleton, empty-state, error-state, or the list. ProjectNav gains a 5th "Schedules" tab with GS keyboard shortcut. 42 new unit tests added (627 total).
- **Details:**
  - RedEye supports scheduled recurring tasks via `.redeye/schedules.md` (SCHED-{id} format with frequency, last run, steps, assigned roles)
  - Add a new "Schedules" tab to the project dashboard (alongside Overview, Backlog, History, Live)
  - The tab displays all defined schedules: name, frequency, last run time, next due time, and status (on-time / overdue)
  - Allow viewing schedule details (steps, assigned roles) in an expandable row or drawer
  - Read-only for now (adding/editing schedules is a future enhancement)
  - API: GET /api/projects/[id]/schedules — parse `.redeye/schedules.md` and return structured schedule data
  - Add keyboard shortcut GS for navigation (consistent with GB/GH/GL pattern)
  - Add unit tests for the parser and API route
  - Add to ProjectNav alongside existing tabs

### T054: T029 and T030 are in the backlog but were never picked
- **Type:** bug
- **Priority:** P1
- **Status:** wont-do
- **Added:** 2026-04-25 (iter 85)
- **Reason:** CEO noted T029 and T030 were never actioned. On investigation: both are already marked wont-do. T029 is a duplicate of T013 (reopened and completed iter 42). T030 is also superseded by T013. Both bugs were resolved when T013 fixed the Live tab EventSource issue with Playwright verification. No further action required.

### T053: Improve session history page — show phase timeline and cost per session
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 83)
- **Added:** 2026-04-25 (iter 79)
- **Spec:** docs/specs/T053-session-history-phase-timeline.md
- **Summary:** The history page now shows a Sessions section above the Iteration Log, with one row per JSONL transcript file. Each row displays the session date, approximate duration, a cost badge, and a strip of phase chips (TRI, PLN, BLD, REV, DEP, VER) extracted from the transcript. A pre-existing infinite render loop in the sessions section was also found and fixed during this cycle.
- **Details:**
  - The history page at /project/[id]/history shows a flat session list with start/end times
  - Enrich each session row with: total cost for that session, number of phases completed, and a mini phase timeline (PLAN → BUILD → REVIEW → DEPLOY chips)
  - Parse session cost from the corresponding JSONL transcript file
  - Show a "phases completed" count badge and an expandable phase list on each row
  - Should use existing cost-calculator.ts and transcript-file-resolver.ts

### T052: Add keyboard shortcuts for common actions (Start, Stop, Backlog navigation)
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

### T051: Cost analytics — add cumulative cost chart to mission control
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 81)
- **Added:** 2026-04-25 (iter 79)
- **Spec:** docs/specs/T051-cost-analytics-sparkline.md
- **Summary:** Added a cumulative cost sparkline to the mission control Cost card. Each bar represents one session's cost over the last ten sessions, implemented as a pure SVG component with no new dependencies. The sparkline respects dark and light mode and is hidden when no session history exists.
- **Planning:** Pure SVG sparkline (no new deps). New `lib/cost-history.ts`, `GET /api/projects/[id]/cost-history`, `SparklineChart` component, and `CostCard` extension. 6 sub-tasks (4S+1M+1S). No CEO questions needed.
- **Details:**
  - The cost card shows current session + total as numbers, but no trend data
  - Add a simple bar or line sparkline chart showing cost per session over the last 10 sessions
  - Use recharts (already in many Next.js stacks) or a lightweight SVG chart — check if recharts is already in package.json; if not, implement as a pure SVG component to avoid adding a dependency
  - Chart should be responsive and respect dark/light mode
  - Data source: parse each JSONL transcript file for cost_usd sum per file (one file = one session)

### T050: Add in-app notification toast when RedEye phase changes (BUILD, REVIEW, DEPLOY, DONE)
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 80)
- **Added:** 2026-04-25 (iter 79)
- **Details:**
  - Users have no awareness of phase changes without watching the dashboard constantly
  - When the mission control 5s poll detects a phase change, show a toast notification (e.g. "RedEye entered BUILD phase — working on T049")
  - Use the browser Notification API with permission request on first interaction; fall back to an in-app toast overlay if permission denied
  - Toast should auto-dismiss after 5 seconds; clicking it navigates to the Live tab
  - Add unit tests for the notification hook (mock Notification API)
- **Summary:** Phase-change toast notifications are now shown in the mission control page whenever RedEye enters BUILD, REVIEW, DEPLOY, VERIFY, or DONE. A ToastProvider and ToastContainer were wired into the root layout, with an auto-dismissing overlay and a browser Notification API fallback. Thirty new unit tests and four Playwright E2E tests verify the feature end-to-end.

### T049: Expand E2E test coverage — Playwright specs for backlog CRUD, start/stop flow, and cost card
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 79)
- **Added:** 2026-04-25 (iter 79)
- **Spec:** docs/specs/T049-e2e-test-coverage.md
- **Details:**
  - Current Playwright coverage is limited to smoke tests and the logo mark
  - Add three new E2E specs:
    1. Backlog CRUD: add a task via dialog, verify it appears in list, navigate to detail, verify fields render
    2. Start/Stop flow: click Start, verify button state changes to "Stop" and working-on card updates; click Stop, verify return to idle
    3. Cost card: verify cost card renders, values are non-negative, session cost <= total cost invariant holds in the DOM
  - Each spec should run against http://localhost:3200 with an existing initialized project
- **Summary:** Added two new Playwright E2E specs: backlog-crud.spec.ts exercises the full add-via-dialog flow through to the detail page, and cost-card.spec.ts verifies the session/total cost non-negative invariant and exact value formatting. Both specs use route interception to avoid external dependencies.

### T048: In the live tab, User boxes need to be collapsible and collapsed by default In the live tab, User boxes need to be collapsible and collapsed by default
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 57)
- **Summary:** User message boxes in the Live tab transcript are now collapsible and collapsed by default, reducing visual noise. A sticky Collapse All / Expand All toolbar was added to let users toggle all boxes at once without losing their scroll position.

### T047: Update dashboard logo
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 63)
- **Spec:** docs/specs/T047-logo.md
- **Planning:** Split-weight "Control Tower" text mark (CONTROL small / TOWER large, both red-600/red-500) replacing flat single-span in app/layout.tsx; linked to /. 3 sub-tasks (all S): T1 implement mark, T2 remove unused public SVGs, T3 unit tests. No image assets needed.
- **Summary:** Replaced the flat single-line header text with a split-weight two-span logo mark — "CONTROL" in small bold tracking-widest and "TOWER" in large black weight, both in red-600/red-500 with dark mode variant, wrapped in a Link to /. Five unused default Next.js scaffold SVGs were removed from public/. Five unit tests and three Playwright E2E tests confirm the link, text content, and navigation behaviour.

### T046: Per task cost (est) not autoamtically recorded at the end of each task. it should be the value at the end of the task minus the value at the begining
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/T046-auto-cost-recording.md
- **Planning:** Spec written iter 55. Delta detection via mission control 5s polling loop; new cost-start endpoint captures session baseline; cost-snapshot updated to compute end-minus-start. 6 sub-tasks (4S + 1M + 1S), ~13 new unit tests.
- **Summary:** Per-task cost is now recorded automatically as an end-minus-start delta. When the mission control page detects a task transition via its 5-second poll, it fires a cost-start POST at task activation and a cost-snapshot POST at completion; the snapshot endpoint computes the delta and stores only the cost attributable to that task. Older items without a start record continue to fall back to the manual "Record now" button.

### T045: can we use the designer sub agent and frontend skill to improve the design of the main project screen?
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 61)
- **Summary:** Redesigned the mission control project page to a 3-column grid with Controls promoted into the first row alongside the wide WorkingOn card, removing decorative borders and section dividers for a cleaner layout. The active task title is now displayed at text-base size with a compact running pill badge shown inline beneath the project name in the header.

### T044: In the main screen for a project, i dont like the text +Backlog in the button. can we improve the button? use the designer and frontend skills
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-25 (iter 58)
- **Summary:** Replaced the minimal "+Backlog" label with an "Add to Backlog" button featuring a PlusCircle icon and indigo accent styling, making the action clearer and visually distinct in both light and dark mode. A unit test was added to verify the button's accessible name and click handler.

### T043: force stop redeye should be part of a dropdown of the stop button. not a bigger button. the stop button has a dropdown with force stop
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/T043-force-stop-dropdown.md
- **Summary:** Replaced the standalone Force Stop button with a split-button pattern on the Stop button: a chevron caret opens a dropdown containing Force Stop, with a two-click inline confirmation and 4-second auto-dismiss replacing the previous Shift+click gesture. The Controls card is now more compact and the power action remains discoverable.

### T042: in the backlog detail view, cost (est) shows as Not recorded. fix it
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/T042-backlog-detail-cost.md
- **Summary:** Fixed the backlog detail cost row to correctly surface cost data from the cost-snapshot API, distinguishing between items with a genuine zero cost and items where no snapshot was ever recorded. Added a "Record now" button for done items missing a snapshot, and expanded the test suite with 15 new cases covering all display states.

### T041: IN the backlog, done tasks should be in a separate section so they don't clutter the ui. use the design subagent and frontend skill to re-design this page
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 54)
- **Spec:** docs/specs/T041-backlog-done-section.md
- **Summary:** Redesigned the backlog page to separate done tasks into a collapsible "Done" section below the active/planned items. Done tasks are hidden by default and toggled with a chevron button showing the count, reducing visual clutter while keeping completed work accessible.

### T040: In the live tab I still don't see Claude's inter round status messages or thoughts. just tool uses
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Spec:** docs/specs/T040-live-tab-messages.md
- **Planning:** Root cause is in TranscriptViewer rendering, not normalizer or SSE. Thinking blocks render as invisible bare italic text; text messages lack visual identity. Fix: ThinkingCard (collapsible violet card), AssistantTextCard (red left-border + "Claude" label), suppress plain user messages. 5 sub-tasks (4S + 1S E2E), 1 new test file.
- **Summary:** The Live tab now shows Claude's inter-round text messages and internal thoughts alongside tool uses. Thinking blocks appear as collapsible violet cards labeled "Claude's Thinking", assistant text messages appear with a red left border and "Claude" label, and plain user prompt messages are suppressed to reduce noise.

### T039: When RedEye stops due to empty backlog, show a clear message in the UI: "RedEye stopped — backlog empty. Add tasks to resume." instead of just showing Idle.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Summary:** Added a "Backlog empty" state to the WorkingOn card and home page phase badge so that when RedEye stops due to an empty backlog, the UI displays a clear actionable message instead of the generic Idle label. Unit tests cover the new state.

### T038: T027 cost visibility bug — detail-page cost field not rendering despite code present; verify data flow in item_costs population.
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 49)
- **Source:** Q-005 adjustment (iter 48) — CEO reports cost field invisible in UI
- **Context:** T020 T7 shipped cost-per-item infrastructure and code to display `Cost (est.)` on backlog detail page (lines 273–278 in `app/project/[id]/backlog/[taskId]/page.tsx`). However, CEO verified with Playwright that the field is not visible. Suspect issue: `item_costs` in state.json not being populated for completed items, or enrichment logic failing in the GET route.
- **Summary:** Fixed: the cost row (`Cost (est.)`) now always renders for done items in the backlog detail page. Pre-fix, the row was gated behind a condition that could suppress it; post-fix it renders unconditionally for `status === "done"`, showing `$X.XX` when cost_usd is recorded or "Not recorded" for items predating T020. Cost snapshot for T038 recorded at VERIFY time ($44.71). Steering directive to POST cost-snapshot at every future VERIFY was executed and cleared.

### T037: Add Force Stop button (hard kill) for unresponsive sessions — complements graceful stop.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 50)
- **Source:** Q-004 adjustment (iter 48) — CEO wants Force Stop in addition to graceful Stop
- **Context:** T034/035/036 shipped graceful Stop/Pause (writes STOP/PAUSE directive to steering.md; CTO exits at next phase boundary). CEO requests a complementary Force Stop button for stalled/unresponsive sessions. This button should hard-kill the subprocess without waiting for graceful shutdown.
- **Acceptance criteria:**
  - Add "Force Stop" button (or icon variant) alongside graceful Stop in mission control and home page project cards
  - Force Stop: SIGKILL the active claude child process via session-manager
  - UI shows "Force stopping…" state; graceful button is disabled while force stop is in progress
  - No backlog item state change (leave as-is until next TRIAGE)
  - Test: start session, trigger Force Stop, verify process exits immediately and UI returns to idle

### T036: Stop button not working from home page project cards either — same bug as T034 but affects the main screen, not just mission control.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/T034-stop-pause-fix.md

### T035: Pause button does not work — clicking Pause in browser has no effect on the running session.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/T034-stop-pause-fix.md

### T034: Stop button does not work — clicking Stop in browser has no effect on the running session.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 44)
- **Spec:** docs/specs/T034-stop-pause-fix.md

### T032: Live tab auto-scroll UX fix — when auto-scroll is on, user cannot scroll up because it snaps back. Auto-scroll should pause when user scrolls up and resume when they scroll back to bottom.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 45)
- **Spec:** docs/specs/T032-autoscroll.md

### T031: Live tab transcript viewer — fold tool/terminal output by default, only show Claude inter-round messages and thoughts unfolded. Should look like a readable session log, not raw JSONL dump.
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 43)
- **Spec:** docs/specs/T031-live-tab-fold-tools.md

### T030: Fix Live tab — T013 was marked done but Live tab still shows nothing. EventSource doesn't receive data despite transcript files existing. Must verify with Playwright before closing.
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Reason:** Superseded by T013 (reopened and completed iteration 42). Live tab now tails Claude transcripts with Playwright verification (screenshots: bl013-verify-iter42-live-tab.png, deploy-smoke-live-tab.png). Closed as duplicate at TRIAGE iter 43.

### T001: Smoke test all pages using Playwright browser
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

### T002: Fix Live tab showing nothing
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Details:**
  - Live tab at /project/{id}/live shows blank when no active session
  - Add empty state: "No active session. Start RedEye to see live output."
  - When session IS running, verify SSE stream connects and renders events

### T003: Test Start/Stop flow end-to-end
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - Click Start on haze, verify button changes to Stop
  - Verify Working On card updates
  - Click Stop, verify session stops and UI returns to idle

### T004: Polish UI consistency
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Details:**
  - Loading states on every page
  - Error states with user-friendly messages
  - Empty states with appropriate messaging
  - Nav tabs highlight correctly on each page
  - Responsive layout on narrower viewports

### T005: Verify onboarding wizard end-to-end
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Details:**
  - Create fresh test project, add via Add Project
  - Verify wizard starts, fill in fields, initialize
  - Verify redirect to mission control

### T009: Support both dark and light mode properly
- **Type:** feature
- **Priority:** P0
- **Status:** done
- **Spec:** docs/specs/T009-dark-light-mode.md
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

### T010: Detect and recover from stalled sessions (quota exhaustion, permission prompts)
- **Type:** feature
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/T010-stall-detection.md
- **Details:**
  - When claude --print hits a quota wall, it shows an interactive menu that can't be answered in headless mode. The process hangs indefinitely.
  - In session-manager.ts: add a health check that monitors the .jsonl log file. If no new output for 10 minutes but the process is still alive, kill and restart it.
  - In the UI: show a warning on the mission control page when a session is stalled ("Session stalled — no output for 10 minutes") with a Restart button.
  - Add a `lastActivity` timestamp to SessionInfo derived from the log file's mtime.
  - The controls card should show "Stalled" state with amber border when detected.

### T011: Enforce BL-xxx ID counter at write level — prevent duplicate IDs
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Spec:** docs/specs/T011-enforce-bl-id-counter.md
- **Details:**
  - Multiple entry points can add backlog items: /redeye:backlog command, dashboard API, manual edits, HARDEN-discovered items
  - The BL counter in state.json can get out of sync if any entry point skips incrementing it
  - Fix: in the PATCH and POST backlog API routes, always read the current max BL-xxx from backlog.md and ensure new items get the next available ID
  - Add a utility function `getNextBacklogId(projectPath)` that reads both state.json counter AND scans backlog.md for the actual highest BL-xxx, returns whichever is higher + 1, and updates state.json
  - All code paths that create backlog items must use this function

### T016: Make phase badge more prominent and dynamic
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

### T015: Show cost tracking on mission control
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

### T013: Live tab should tail Claude transcript files
- **Type:** bug
- **Priority:** P0
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/T013-live-tab-fix.md
- **CEO Note:** REOPENED. Was marked done but Live tab still shows nothing. The transcript resolver and stream route were updated but the EventSource connection in the browser doesn't receive any data. Must be visually verified with Playwright before marking done again.
- **Details:**
  - Live tab shows nothing because it looks for .redeye/session-cto.jsonl which only exists for Control Tower-spawned sessions
  - Sessions started from CLI use the ralph-loop stop hook and don't produce JSONL output
  - Fix: tail Claude's transcript files from ~/.claude/projects/-Users-casa-{project-slug}/*.jsonl instead
  - Find the most recent transcript file by mtime
  - Update the SSE stream API route and stream-utils to use this path
  - The transcript format is JSONL with type/message fields — similar enough to parse

### T014: Backlog page should show currently active task as "In Progress" at the top
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

### T017: Cost card leaves empty column in mission control grid
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Source:** User Tester (iteration 32, BUG-1)
- **Details:**
  - Cost card sits alone in left column, leaving right column blank when Questions card spans full width below
  - Fix: make Cost card span full width, or pair it with another card in the grid

### T018: Project cards on home page don't show current phase or active task
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/T018-home-status.md
- **Source:** User Tester (iteration 32, BUG-2)
- **Details:**
  - ProjectCard always shows "Idle" / "No active task" even when project is running
  - The phase and currentTask fields are not populated from state.json in the projects API
  - Fix: read state.json in the projects list API and pass phase + backlog_title to ProjectCard

### T006: Duplicate backlog items cause React key warnings and visual duplicates
- **Type:** bug
- **Priority:** P2
- **Status:** done
- **Details:**
  - When a backlog.md file contains the same BL-xxx ID in multiple sections (e.g. CEO Requests and Triaged), parseBacklog returns duplicate items
  - This causes React "duplicate key" console errors on the Mission Control page and shows the same item multiple times in the Up Next list
  - Fixed by adding deduplication in parseBacklog() — keeps the last occurrence when the same ID appears in multiple sections
  - Reproduction: haze project had T001 in both CEO Requests and Triaged sections
  - Screenshot: screenshots/T2-mission-control.png (shows duplicate before fix)

### T019: Fix cost invariant — session cost can exceed total when cliDir unreadable
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/T019-cost-invariant-fix.md
- **Source:** Discovered (iteration 33 — known live bug in T015)
- **Details:**
  - In app/api/projects/[id]/cost/route.ts, when cliDir is unreadable the session cost is computed from the active JSONL log but total is computed only from readable transcript files
  - This can cause sessionCost > totalCost, violating the invariant that total >= session
  - Fix: apply Math.max(totalCost, sessionCost) before returning to ensure total always covers session
  - Also guards against any rounding edge cases

### T021: Add questionCount to ProjectWithStatus — remove unsafe cast in ProjectCard
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24
- **Source:** HARDEN (iteration 37)
- **Details:**
  - ProjectCard line 38 uses `(project as ProjectWithStatus & { questionCount?: number }).questionCount` — unsafe cast
  - Fix: add `questionCount?: number` to `ProjectWithStatus` type and populate it in the projects list API route

### T022: Add unit tests for critical API routes (start, stop, restart, backlog CRUD)
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

### T023: Add auto-refresh polling to home page project cards
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

### T024: Add aria-labels to all interactive buttons and controls
- **Type:** ux
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-25 (iter 59)
- **Spec:** docs/specs/T024-aria-labels.md
- **Source:** CTO (iteration 37, HARDEN phase)
- **Details:**
  - 14+ interactive buttons across the app have no aria-label, making them inaccessible to screen readers
  - Priority targets: icon-only buttons in mission control cards, dialog action buttons, and expandable toggles in transcript viewer
  - Fix: add descriptive aria-label to all icon-only buttons and ambiguous interactive elements; verify dialog inputs have associated <label> or aria-label
  - Run Playwright accessibility scan after fix to catch remaining issues
- **Summary:** Added aria-labels and linked labels to all interactive buttons and form controls across the dashboard, covering icon-only buttons in mission control cards, dialog fields, and transcript viewer toggles. A dedicated unit test suite and a Playwright E2E spec were added to assert accessible names on key controls.

### T025: Wrap unguarded API route handlers in try-catch for safe error responses
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

### T026: Completed backlog items should have a collapsible LLM summary
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

### T029: Fix Live tab — EventSource connection receives no data despite transcript files existing
- **Type:** bug
- **Priority:** medium
- **Status:** wont-do
- **Reason:** Duplicate of T013 (reopened). T013 covers the same bug and is currently being planned in iteration 40.

## Triaged

### T064: the cost plot is nice, but it seems scaled weird, the text is very wide while not tall. it feels like a stretched image. fix it
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Merged:** 2026-04-25 (iter 93)
- **Spec:** docs/specs/T064-cost-plot-scaling.md
- **Summary:** Fixed the cost sparkline aspect ratio by increasing VIEW_H from 48 to 80 (2.5:1 ratio instead of 4.17:1), removing the `width="100%"` SVG attribute, and adding `height={80}` so the browser renders the chart at its natural height without horizontal distortion. Removed the `max-h-[72px]` container clamp. Updated 3 test files; 663/663 tests pass and the production build is clean.

### T027: Show cost for completed items in backlog list and detail page
- **Type:** bug
- **Priority:** P1
- **Status:** done
- **Completed:** 2026-04-24 (iter 47)
- **Source:** VP Product triage (iteration 40)
- **Spec:** docs/specs/T027-backlog-list-cost.md
- **Details:**
  - T020 added cost-per-item via cost snapshots but the cost is not visible in the backlog list page or detail page
  - Read item_costs from state.json and display cost next to each completed item in the backlog list
  - Show cost on the backlog detail page for done items
  - Format as "$X.XX" in a subtle secondary label
- **Planning note (iter 46):** Detail-page cost already shipped in T020 T7. T027 focuses on the list page gap; see Q-005 for confirmation.

### T020: Show cost per completed backlog item in Recently Shipped card
- **Type:** feature
- **Priority:** P2
- **Status:** done
- **Completed:** 2026-04-24
- **Spec:** docs/specs/T020-cost-per-item.md
- **Source:** User Tester (iteration 32 feedback) + T015 spec (not implemented)
- **Details:**
  - The T015 spec called out "Also show cost per completed backlog item in the Recently Shipped card and backlog detail page" but this was never implemented
  - In the Recently Shipped card on mission control, each completed item should show its cost contribution (e.g. "$1.42")
  - Store cost snapshot in state.json item_costs map when item transitions to done
  - Show as a subtle secondary label next to each completed item
  - Also show on the backlog detail page
