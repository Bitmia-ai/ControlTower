# Changelog

All notable changes to Control Tower are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed

- **Stop route now actively kills the session.** `POST /api/projects/[id]/stop` writes the STOP directive to `steering.md` AND calls `stopSession()` (SIGTERM + 10 s SIGKILL). Previously the route was graceful-only and a wedged model would keep burning tokens after a Stop.
- **Answer route inbox + state.json writes are now atomic.** Both the inbox r/m/w and the `state.json` health-counter update run inside `withProjectLock` so concurrent POSTs cannot corrupt either file.
- **`session-manager` respawn gate.** `isProjectIdle()` now blocks auto-restart when the project is intentionally stopped (STOP directive present). Prevents the watchdog from undoing a deliberate Stop.
- **`markdown-sanitize` strips U+2028 / U+2029.** Line-separator and paragraph-separator characters are now removed alongside other control characters to prevent JSON parse errors in edge environments.

### Added

- **`lib/process-utils.ts`** — process-existence helpers extracted from `session-manager.ts` and `worktree-pruner.ts`; reduces duplication and makes both files independently testable.
- **`lib/fetch-utils.ts`** — `fetchJsonWithTimeout` helper extracted from `cost-card` and `velocity-card` mission-control components.
- **`lib/state-mutex.ts`** — per-project async mutex (`withProjectLock`) used by the answer route.
- **`components/page-header.tsx`** — shared page header extracted from Tasks, Schedules, and History page clients.
- **`live-client.tsx` `upsertByKey` export** — collapses duplicate events on stream replay so the Live tab does not show duplicate rows on reconnect.
- **`session-manager.PROMPTS` export** — prompt map for all session roles is now exported with a contract test to prevent silent breakage.

### Fixed

- **Task detail save errors now surface in-UI.** `task-detail-client.tsx` now displays the server error message on a failed save and keeps the user in edit mode, instead of silently losing the edit.
- **Tasks tab polling no longer storms on rapid tab switches.** `tasks-client.tsx` polling uses `detailRef` (a stable ref) instead of `detail` state so the polling `useEffect` does not re-register on every render.

### Security

- Pin `postcss` to `^8.5.10` via `package.json` `overrides` to force resolution of next.js's nested `postcss@8.4.31` copy, resolving moderate-severity XSS advisory [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) (T153). `npm audit --omit=dev` now reports 0 vulnerabilities.

---

## [0.2.0] — 2026-04-27

### Added

- Coverage reporting in CI with `@vitest/coverage-v8`; Codecov badge in README (T101)
- GitHub structured issue forms — `bug_report.yml` (OS/Node/version fields) and `feature_request.yml` with local-only checkbox (T102)
- `.github/CODEOWNERS` — auto-request review from @Bitmia-ai on every PR (T096)
- `.env.example` documenting all five runtime env vars (`REDEYE_CONFIG_PATH`, `REDEYE_PLUGIN_DIR`, `CLAUDE_BIN`, `ALLOW_OUTSIDE_HOME`, `HOME`) (T092)
- `.github/dependabot.yml` for npm + github-actions (weekly Monday, minor/patch grouped, major ignored for next/react/tailwindcss) (T100)
- Steer tab — view, add, edit, and delete steering directives with markdown rendering (T063, T072, T073)
- Schedules tab — view, run, add, and delete scheduled tasks (T055, T058, T070, T081)
- Live tab: collapsible user boxes, labeled toolbar buttons ("Expand all", "Collapse all", "Auto-scroll"), auto-scroll pause when scrolling up (T048, T080, T032)
- Phase-change toast notifications (browser Notification API + in-app overlay fallback) (T050)
- Per-task cost recording — end-minus-start delta auto-recorded on task transition (T046)
- History tab: session rows with cost badges, phase chips, start/end timestamps, UUID de-emphasis (T053, T078)
- Backlog: Done section, Won't Do section, per-task cost display, collapsible LLM summary field (T041, T065, T026)
- Pagination and filtering on all four major list views (Tasks, Schedules, Steer, History) (T084)
- Home page and all project tabs redesigned with precision-instrument design system — 3 px status top-border, monospace labels, pulsing dot (T066, T067, T071)
- Mobile-responsive layout across all pages (Tailwind responsive prefixes, 44 px touch targets) (T057)
- Keyboard shortcuts: S/X/P to Start/Stop/Pause, B to add backlog, G+B/H/L/S for tab navigation (T052)
- Cost sparkline on mission control — per-session cost bars over last 10 sessions (T051)
- Dark/light mode toggle wired to OS preference via next-themes; theme persisted (T009)
- Working On card: phase case-normalization, task title display, rich phase messages for all phases (T085)
- Tasks tab count badge — red pill showing number of open tasks (T108)
- Empty state for first-run onboarding — welcome copy with RedEye links and `redeye:init` instructions (T094)
- Troubleshooting section in README with 6 common failure scenarios (T093)
- Per-page `<title>` tags for all 8 dashboard pages (T077)
- `turbopack.root` in next.config.ts to suppress workspace root dev warning (T077)
- Proxy migration: `middleware.ts` → `proxy.ts` (Next.js 16 convention) + 19 unit tests (T098)
- README screenshots refreshed: home, mission control, task detail (T091)
- PWA viewport meta — prevents iOS auto-zoom on input focus (T079)
- Stall detection: sessions auto-restarted after 10 min with no output; amber warning on mission control (T010)
- Force Stop button nested in Stop dropdown with two-click inline confirmation (T037, T043)
- Auto-resume on inbox answer — dashboard restarts CTO when `waiting_for_ceo` answer is filed (T060)
- Dependency updates: lucide-react 1.11, react/react-dom 19.2.5, TypeScript 6.0, @types/node 25 (T076)

### Fixed

- Dashboard showed "running" when CTO process was dead — now uses PID file + process-table lookup, 5 s fallback (T059)
- Task detail page did not render the `Description` field (T107)
- ControlsCard button alignment and icon consistency — all 5 buttons now have icons + inline-flex layout (T083)
- Recently Shipped card sorted oldest first and showed only 5 items — now sorts newest first, shows 8 with relative time (T082, T089)
- Health card showed session shipped count instead of total done count (T090)
- Home page task count badge on Tasks tab showed only visible slice (T108, T086)
- New schedule showed "last run: 56 years ago" — fixed to show "Never run" for new schedules (T087)
- Up Next card showed the currently in-progress task when no pending tasks remained (T088)
- Session history collapsibles showed raw UUID filename with no context (T078)
- Backlog detail cost field not rendering despite code being present (T038)
- Cost card sparkline was stretched (4.17:1 ratio) — corrected to 2.5:1 (T064)
- `next.config.test.ts` tests now pass with `@vitest-environment node` annotation (T099)

---

## [0.1.0] — 2026-04-23

### Added

- Initial release
- Home page with project cards showing phase, active task, cost, and question count
- Mission control page: Working On, Controls, Cost, Questions, Recently Shipped, Health cards
- Task list and detail pages with full CRUD (add, edit, view)
- History tab with session list and iteration log
- Live tab tailing Claude transcript JSONL files via SSE
- Start / Stop / Restart / Pause controls
- Per-project cost tracking (session + total from JSONL transcripts)
- Add-to-task dialog; Add-project dialog
- Smoke tests with Playwright

---

[Unreleased]: https://github.com/Bitmia-ai/ControlTower/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Bitmia-ai/ControlTower/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Bitmia-ai/ControlTower/releases/tag/v0.1.0
