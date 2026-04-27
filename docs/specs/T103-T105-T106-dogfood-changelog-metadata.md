# Spec: T103 + T105 + T106 — Self-dogfood doc note, CHANGELOG v0.2.0, GitHub repo metadata

**Iteration:** 126  
**Tasks:** T103 (P3, docs), T105 (P3, chore), T106 (P3, chore)  
**Tier:** S (all three; pure docs/metadata, no code changes)

---

## T103 — Self-dogfood doc note for prod-rebuild caveat

### Context

When CT autodevelops itself (a CT project pointing at `/Users/casa/ControlTower`), RedEye's DEPLOY phase rebuilds main's `.next/` while the prod server is reading from it — chunks go stale, page crashes. With the worktree-isolation fix in the CTO instructions, this no longer happens for new tasks since BUILD/DEPLOY run in `.worktrees/T-N/.next/`. But the caveat is worth documenting so a future contributor knows what to expect.

### Changes

**`CLAUDE.md`** — add one paragraph in a new `## Self-dogfood caveat` section (or append to existing Tailscale section):

```
## Running CT against its own repo

When Control Tower manages its own development (a project pointing at this repo), RedEye's DEPLOY phase rebuilds `.next/` in a temporary worktree — not in the main checkout — so the prod server's chunks stay consistent. If you point CT at this repo using an older CTO setup that does not use worktree isolation, the prod server may crash on DEPLOY with "Unexpected token" or "Cannot find module" errors because chunks are rewritten mid-request. Fix: restart with `npm run build && npm start` after DEPLOY completes.
```

**`README.md`** — add a footnote under the existing "Project page shows 'Something went wrong'" Troubleshooting entry (already mentions the symptom). Insert a note just before the ## Architecture heading:

```
> **Running CT against itself?** RedEye's DEPLOY phase runs in a worktree, so the prod server is not affected during builds. If you're on an older setup and see chunk errors after DEPLOY, run `npm run build && npm start` to recover.
```

No tests needed (pure docs).

---

## T105 — CHANGELOG.md + v0.2.0 tag

### Context

First public changelog following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Two entries: v0.1.0 (initial OSS release) and v0.2.0 (current state — task rename, logo, worktree fix, CI, etc.). After CHANGELOG is written, bump `package.json` to `0.2.0` and create git tag `v0.2.0`.

### Changes

**`CHANGELOG.md`** — new file at repo root:

```markdown
# Changelog

All notable changes to Control Tower are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_(Nothing yet.)_

---

## [0.2.0] — 2026-04-27

### Added
- Coverage reporting in CI with `@vitest/coverage-v8`; Codecov badge in README (T101)
- GitHub structured issue forms — `bug_report.yml` (OS/Node/version fields) and `feature_request.yml` (T102)
- `.github/CODEOWNERS` — auto-request review from @Bitmia-ai on every PR (T096)
- `.env.example` documenting all five runtime env vars (T092)
- Steer tab — view, add, edit, and delete steering directives (T063, T072, T073)
- Schedules tab — view, run, add, and delete scheduled tasks (T055, T058, T070, T081)
- Live tab: collapsible user boxes, labeled toolbar buttons, auto-scroll pause on scroll-up (T048, T080, T032)
- Phase-change toast notifications (browser Notification API + in-app fallback) (T050)
- Per-task cost recording (end-minus-start delta, auto-recorded on task transition) (T046)
- History tab: session rows with cost badges, phase chips, timestamps, UUID de-emphasis (T053, T078)
- Backlog: Done section, Won't Do section, per-task cost, collapsible LLM summary (T041, T065, T026)
- Pagination and filtering on all four major list views (T084)
- Home page and all project tabs redesigned with precision-instrument design system (T066, T067, T071)
- Mobile-responsive layout across all pages (T057)
- Keyboard shortcuts (S/X/P/B to Start/Stop/Pause/Add, G+B/H/L/S tab navigation) (T052)
- Cost sparkline on mission control (T051)
- Dark/light mode toggle wired to OS preference with next-themes (T009)
- Working On card: phase case-normalization fix, task title display, all phase messages (T085)
- PWA viewport meta — prevents iOS auto-zoom on input focus (T079)
- `.github/dependabot.yml` for npm + github-actions (weekly, minor/patch grouped) (T100)
- Proxy migration: `middleware.ts` → `proxy.ts` + 19 unit tests (T098)
- Empty state for first-run onboarding with RedEye links and `redeye:init` instructions (T094)
- Troubleshooting section in README with 6 common issues (T093)
- Per-page `<title>` tags via metadata export (T077)
- Dependency updates: lucide-react 1.11, react 19.2.5, TypeScript 6.0, @types/node 25 (T076)
- Stall detection: auto-restart stalled sessions, amber warning on mission control (T010)
- Force Stop button nested in Stop dropdown with two-click confirmation (T037, T043)
- README screenshots refreshed (home, mission control, task detail) (T091)

### Fixed
- Dashboard shows "running" when CTO process is dead — PID lookup over log freshness (T059)
- Auto-resume on inbox answer (T060)
- Task detail page does not render Description field (T107)
- ControlsCard button alignment and icon consistency (T083)
- Recently Shipped card sorts newest first, shows relative time (T082)
- Home page task count badge on Tasks tab (T108)
- Cost card sparkline aspect ratio (T064)
- Session history collapsibles showed raw UUIDs (T078)
- Backlog detail cost field not rendering (T038)
- Pagination total counts showed only visible slice (T086)
- New schedule showed "last run: 56 years ago" (T087)
- Up Next card showed in-progress task when no pending tasks remain (T088)
- Recently Shipped showed wrong top-10 items (T089)
- Health card showed session shipped count instead of total (T090)
- next.config.test.ts tests fixed with @vitest-environment node (T099)

---

## [0.1.0] — 2026-04-23

### Added
- Initial public release
- Home page with project cards (phase, task, cost, question count)
- Mission control page: Working On, Controls, Cost, Questions, Recently Shipped, Health
- Backlog list and detail pages with task CRUD
- History tab with session list and iteration log
- Live tab tailing Claude transcript JSONL files via SSE
- Start / Stop / Restart / Pause controls
- Per-project cost tracking (session + total from JSONL transcripts)
- Add-to-backlog dialog
- Add-project dialog
- Smoke tests with Playwright

[Unreleased]: https://github.com/Bitmia-ai/ControlTower/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Bitmia-ai/ControlTower/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Bitmia-ai/ControlTower/releases/tag/v0.1.0
```

**`package.json`** — bump `"version": "0.1.0"` → `"version": "0.2.0"`.

**Git tag** — after committing: `git tag v0.2.0` (lightweight tag; CEO can push with `git push origin v0.2.0` when ready).

No tests needed (pure docs + version bump).

---

## T106 — GitHub repo metadata

### Changes

Run these two `gh` commands (no file changes committed):

```bash
gh repo edit Bitmia-ai/ControlTower \
  --description "Web dashboard to orchestrate RedEye autonomous dev sessions across multiple projects. Local-only, binds to 127.0.0.1." \
  --add-topic redeye \
  --add-topic claude-code \
  --add-topic autonomous \
  --add-topic dashboard \
  --add-topic orchestration \
  --add-topic nextjs \
  --add-topic local-first
```

Verify:
```bash
gh repo view Bitmia-ai/ControlTower --json description,repositoryTopics
```

No code changes, no git commit needed for this task.

---

## Sub-task Breakdown

| # | Task | Size | Files |
|---|------|------|-------|
| 1 | CLAUDE.md self-dogfood caveat paragraph | S | `CLAUDE.md` |
| 2 | README.md footnote before Architecture | S | `README.md` |
| 3 | CHANGELOG.md creation | S | `CHANGELOG.md` |
| 4 | package.json version bump 0.1.0 → 0.2.0 | S | `package.json` |
| 5 | Git tag v0.2.0 | S | (git) |
| 6 | gh repo edit description + topics | S | (GitHub API) |

Total: 6 S-tier sub-tasks. No new test files needed. No breaking changes. Build should remain clean.

---

## Acceptance Criteria

- [ ] CLAUDE.md contains a paragraph about the self-dogfood/prod-rebuild caveat
- [ ] README.md has a note about running CT against itself (in or near Troubleshooting)
- [ ] CHANGELOG.md exists at repo root in Keep a Changelog format with v0.1.0 and v0.2.0 entries
- [ ] `package.json` shows `"version": "0.2.0"`
- [ ] Git tag `v0.2.0` exists (not pushed; CEO pushes manually)
- [ ] `gh repo view Bitmia-ai/ControlTower` shows correct description and topics
- [ ] `npm run build` clean
- [ ] `npx vitest run` — no new failures (923 tests, 440 passing, 483 pre-existing)
