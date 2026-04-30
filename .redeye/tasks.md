# Backlog

## CEO Requests

### T155: use the design subagent and frontend skill to improve the Steer tab design
- **Type:** feature
- **Priority:** P1
- **Status:** pending


### T154: Security: scrub /home/user/ paths from tracked test fixtures and lib comments
- **Type:** security
- **Priority:** P0
- **Status:** done
- **Completed:** iter 172 — replaced legacy developer username path prefix with /home/user/ placeholder in .redeye/tasks.md and docs/specs/T154-remove-hardcoded-paths.md. git grep returns 0 hits for original prefix. 1388/1388 tests pass.
- **Description:** 22 tracked files contain hardcoded `/home/user/...` strings — embarrassing publish-readiness leak that reveals the developer username. Examples: e2e/aria-labels.spec.ts:26 `path: "/home/user/haze"`, e2e/start-stop-flow.spec.ts:14 `/home/user/haze`, lib/transcript-file-resolver.test.ts:21 `/home/user/my-project`, lib/cost-history.test.ts:62 `/home/user/my-project`, app/api/projects/[id]/transcript-status/route.test.ts:27 `/home/user/haze`, lib/worktree-pruner.ts:94 comment `/home/user/ControlTower`, lib/transcript-file-resolver.ts:13 comment `/home/user/control-tower`. Tests already mock the filesystem so the path doesn't matter. Acceptance: replace `/home/user/` with `/tmp/` for test fixtures and `/home/user/` for documentation comments across all 22 files; verify `git grep "/home/user"` returns 0 hits in tracked source; npm test still passes 1342/1342.

### T153: Security: address npm audit moderate vulnerabilities (postcss in next)
- **Type:** security
- **Priority:** P0
- **Status:** done
- **Summary:** Added a postcss `^8.5.10` override in package.json so the transitive postcss 8.4.31 bundled inside Next.js is replaced by the patched version, eliminating the moderate XSS vulnerability (GHSA-qx2v-qp2m-jg93). `npm audit --omit=dev` now reports 0 vulnerabilities; all 1388 tests and the production build continue to pass.
- **Description:** `npm audit --omit=dev` reports 2 moderate severity vulnerabilities: postcss <8.5.10 (XSS via unescaped </style>; GHSA-qx2v-qp2m-jg93) is depended on transitively by next 16.2.4. GitHub's dependabot will flag this on a public push and a Staff-level reviewer cloning the repo will see the warning. The "fix" path requires upgrading next, which is a breaking change — instead pin a postcss override in package.json (`"overrides": { "postcss": "^8.5.10" }`) so the transitive dep is bumped without touching next. Acceptance: `npm audit --omit=dev` returns 0 moderate/high/critical findings; `npm run build` and `npm test` still pass; CHANGELOG entry mentions the override.

### T151: Bug: PATCH /api/projects/[id]/tasks/[taskId] missing commitAndPush
- **Type:** bug
- **Priority:** P1
- **Status:** wontdo
- **Won't do reason:** Premise invalid. The task assumed TRIAGE syncs `.redeye/tasks.md` from origin/main, so working-tree edits would be wiped without commit+push. But `.redeye/` is gitignored here: `git show origin/main:.redeye/tasks.md` returns nothing, `git add .redeye/tasks.md` is a no-op, and the dead-code TRIAGE Step 0 sync was removed in `~/redeye` on 2026-04-29. Local writes are durable. The existing `commitAndPush` calls in POST /tasks, POST /steer, POST /answer, DELETE /schedules are dead code too. Follow-up should strip those callers and delete `lib/git-commit-push.ts`.
- **Description:** app/api/projects/[id]/tasks/[taskId]/route.ts:185 writes the updated tasks.md but does NOT call `commitAndPush` like every other write route (POST /tasks, POST /steer, POST /answer, DELETE /schedules, etc.). Result: any task title/priority/description edit made via the dashboard will be silently overwritten on the next CTO TRIAGE iteration when it runs `git pull origin main`. Same gap exists in DELETE /api/projects/[id]/tasks/[taskId]/route.ts:241 and POST /api/projects/[id]/schedules/run/route.ts:106 (writes both schedules.md and tasks.md without committing). Acceptance: add `commitAndPush(project.path, [".redeye/tasks.md"], "ceo: update task TXXX (via dashboard)")` after the `fs.writeFile` in PATCH and DELETE; in run/route.ts commit both schedules.md and tasks.md in one call. Add an assertion-level test in each route that mocks commitAndPush and verifies it's called.

### T150: Bug: schedules DELETE uses non-unique .tmp filename (concurrent-write race)
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T149: Bug: TOCTOU race when answering questions decrements state.health
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T148: Bug: session-history `limit` query param is unbounded
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T147: Refactor: replace key={i} index keys in TranscriptViewer with stable keys
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T146: Test gap: untested API routes (init, stream, sessions)
- **Type:** test
- **Priority:** P1
- **Status:** done
- **Summary:** Added vitest coverage for three previously untested API routes: init (16 cases covering injection-char families, happy path, oversize/non-string fields, spawn failures), stream (11 cases covering SSE headers and line transformer branches), and sessions (3 smoke cases). Full suite grows from 1421 to 1451 tests with zero production code changes.
- **Description:** Three API routes have no .test.ts file: app/api/projects/[id]/init/route.ts (spawns bash + scripts/init-project.sh — high blast radius for shell injection regressions if safeFieldOrThrow is ever weakened), app/api/projects/[id]/stream/route.ts (SSE replay logic + transcript file resolution + session-boundary handling), app/api/projects/[id]/sessions/route.ts (thinnest, but currently zero coverage). Init in particular hardcodes a single regex (route.ts:31) as the entire CSRF-style command-injection defense and a typo there is catastrophic. Acceptance: add three vitest test files (init/route.test.ts, stream/route.test.ts, sessions/route.test.ts). Init: 6+ assertions covering each forbidden char family (CR, LF, NUL, backtick, $, backslash); happy-path with all 5 fields; oversize field (4097 chars) → 400; non-string field → 400. Stream: assert SSE headers correct, lookback replays last N bytes, session boundary sentinel emitted when fileResolver returns a new path. Sessions: thin smoke test of GET handler.

### T145: Test gap: untested lib utilities (markdown-sanitize, json-body, git-commit-push, atomic-write)
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T144: Refactor: dedupe formatRelativeTime between lib and components/schedules
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T143: Chore: wire e2e Playwright tests into CI workflow
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T142: Chore: decide Codecov badge fate before flipping public
- **Type:** chore
- **Priority:** P2
- **Status:** done
- **Description:** README.md lines 11-13 render a Codecov badge that will return 404 / "no data" image to anyone who lands on the public README until (a) the project is added to Codecov and (b) at least one CI run has uploaded coverage. Test workflow currently has `continue-on-error: true` and `fail_ci_if_error: false` (.github/workflows/test.yml:34-44) so the upload is best-effort. Acceptance pick one: (a) remove the badge until post-flip CI succeeds, then re-add; (b) keep it and document the broken-badge window in launch notes; (c) front-load the Codecov setup (add CODECOV_TOKEN secret, run a coverage job on a private branch, verify upload) before flipping public.

### T141: Refactor: replace inconsistent parseInt(id, 10) + isNaN guards with a shared helper
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T140: Refactor: extract structured error logger to replace bare console.error in routes
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T139: Chore: record demo GIF for README hero (manual task)
- **Type:** chore
- **Priority:** P2
- **Status:** wontdo
- **Won't do reason:** Permanently agent-infeasible. Requires manual screen recording on a physical display with a live running session. Cannot be automated by a headless agent. CEO may record and embed manually if desired (see T095 for original description).
- **Description:** README has 4 static screenshots (.github/assets/{home,mission-control,task-detail,backlog-detail}.png) but no animated demo. T095 was marked "permanently agent-infeasible" but this is genuinely a 30-min manual recording task that will 10x first-impression quality on a public flip. Acceptance: record a 30-60s screen capture of the Mission Control flow (Add project → Start session → watch phase progress → answer an inbox question → see task complete in History), convert to GIF or MP4 via ffmpeg, place at `.github/assets/demo.gif` (max 8 MB), embed in README hero block above the existing screenshot table. Note: this task requires a human; do NOT attempt to automate.

### T138: Refactor: split tasks-client.tsx (735 lines) into smaller focused components
- **Status:** done
- **Archive:** docs/tasks-archive/2026-04.md

### T137: Refactor: dedupe append-CEO-task markdown writer between tasks/route and schedules/run/route
- **Type:** refactor
- **Priority:** P3
- **Status:** done
- **Summary:** Extracted a shared `appendCeoTask` helper into `lib/tasks-writer.ts` and updated both the tasks and schedules/run routes to use it, eliminating the duplicated markdown-insertion logic that would have drifted on any future task-schema change.
- **Description:** app/api/projects/[id]/schedules/run/route.ts:112-135 inserts a new task into tasks.md by hand (find `## CEO Requests`, slice content, splice in a hardcoded markdown block at line 122) — the EXACT same logic that already exists in app/api/projects/[id]/tasks/route.ts:62-73. Two copies of the "render markdown task block + insert under CEO header" logic that will drift on the first schema change (e.g. T134 already added an `author` concept that only one of these two writers needs to know about). Acceptance: extract a shared `appendCeoTask(content, { id, title, type, priority, status, schedule? })` helper into lib/tasks-writer.ts (or extend lib/redeye-files.ts), have both routes call it. No behavior change; both tasks/route.test.ts and schedules/run/route.test.ts must still pass.


### T134: For each task in the tasks tab, can we show the "author"
- **Type:** feature
- **Priority:** P0
- **Status:** done
- **Completed:** iter 169 — author badges (Submitted by User / Discovered by RedEye) + Author filter shipped in tasks tab and detail page.
- **Description:** Show one of: "Discovered by RedEye" (implies author == RedEye "Submitted by User" (implies author==user) ... We should show it both in the table and the detail page. Use the design subagent and frontend skill. make it look nice Also update filters so we can filter by "author"

### T112: Publish to npm + end-to-end install verification
- **Type:** feature
- **Priority:** P3
- **Status:** wontdo
- **Won't do reason:** NPM_TOKEN not provided by CEO deadline (2026-05-04). CEO implicit-proceed signal (invoked /redeye:start iter 134) — applying Q-015 option 2: skip for now. Can be re-opened when NPM_TOKEN is available.
- **Source:** Q-014 answer (iter 130) — T104 made the package publish-ready; this task actually publishes and verifies.
- **Description:** Complete the npm publish workflow started in T104. Steps: (1) Toggle `"private": false` in package.json. (2) Verify package name availability: `npm view control-tower` — if taken, use `@bitmia/control-tower`. (3) Run `npm pack --dry-run` one more time to confirm the tarball contents (should match T104's 500 kB / 214 files baseline). (4) Run `npm publish --access public` (or `--access public` for scoped). (5) Verify the published package: `npm view control-tower` shows correct version, description, bin entry. (6) Test the install experience end-to-end in a temp directory: `mkdir /tmp/ct-smoke && cd /tmp/ct-smoke && npx control-tower@latest --help` (or start). (7) Add the npm badge to README: `[![npm version](https://img.shields.io/npm/v/control-tower.svg)](https://www.npmjs.com/package/control-tower)`. (8) Commit badge + private:false change, tag v0.2.1. Acceptance: `npm view control-tower` returns correct metadata; npx install in a temp dir succeeds and prints usage. NOTE: This task requires npm publish credentials — CTO will pause and ask for an NPM_TOKEN if not already set in environment.

### T095: Add demo gif or short video to README
- **Type:** docs
- **Priority:** P1
- **Status:** wontdo
- **Won't do reason:** Permanently agent-infeasible. Requires manual screen recording on a physical display. Cannot be automated by a headless agent. CEO may record and embed manually if desired.
- **Description:** Static screenshots don't convey the autonomous loop. Record a 30–60 second clip showing: (a) home page with project cards, (b) clicking Start on a project, (c) phase progression in real time (TRIAGE → PLAN → BUILD), (d) a task transitioning to "done", (e) cost ticking up. Use `vhs` (terminalizer alternative) or screen-record + ffmpeg to convert to .gif (cap at ~5 MB). Embed in README under the existing screenshot table. The haze project is the cleanest demo target since it's the test app — set up a fresh haze with one task ("print weather for a city via Open-Meteo") and capture the loop.

### T069: Directives int eh Steer tab need to be editable or deletable
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Reason:** Superseded by T072 which covers the same requirement (edit/delete steer directives) and was filed later as the canonical CEO request.

### T054: T029 and T030 are in the backlog but were never picked
- **Type:** bug
- **Priority:** P1
- **Status:** wont-do
- **Added:** 2026-04-25 (iter 85)
- **Reason:** CEO noted T029 and T030 were never actioned. On investigation: both are already marked wont-do. T029 is a duplicate of T013 (reopened and completed iter 42). T030 is also superseded by T013. Both bugs were resolved when T013 fixed the Live tab EventSource issue with Playwright verification. No further action required.

### T030: Fix Live tab — T013 was marked done but Live tab still shows nothing. EventSource doesn't receive data despite transcript files existing. Must verify with Playwright before closing.
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Reason:** Superseded by T013 (reopened and completed iteration 42). Live tab now tails Claude transcripts with Playwright verification (screenshots: bl013-verify-iter42-live-tab.png, deploy-smoke-live-tab.png). Closed as duplicate at TRIAGE iter 43.

## Discovered


### T029: Fix Live tab — EventSource connection receives no data despite transcript files existing
- **Type:** bug
- **Priority:** medium
- **Status:** wont-do
- **Reason:** Duplicate of T013 (reopened). T013 covers the same bug and is currently being planned in iteration 40.

## Triaged

### T136: change Submitted by User to Created by User
- **Type:** feature
- **Priority:** P1
- **Status:** wont-do
- **Won't do reason:** Consolidated into T135. Both tasks rename the same author badge labels; T135 spec (docs/specs/T135-rename-author-to-created-by.md) covers the "Created by User" / "Created by RedEye" rename in full.

