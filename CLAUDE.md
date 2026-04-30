# Control Tower — Claude context

Orientation for any Claude Code session working in this repo. Pair with [README.md](README.md) (what users see) and [ARCHITECTURE.md](ARCHITECTURE.md) (code map + flows).

## What this is

A **Next.js 16 / React 19 / TypeScript** dashboard that orchestrates [RedEye](https://github.com/Bitmia-ai/RedEye) sessions across multiple projects from a browser. Single-user, local-only, no database, no auth.

- Server runs at `http://localhost:3200` and binds to `127.0.0.1`
- All durable state is plain markdown + JSON on disk (`.redeye/*.md`, `~/.redeye/config.json`, `~/.claude/projects/*.jsonl`)
- The dashboard reads `.redeye/*` on every poll; it writes only on explicit user actions (Add Task, Steer, Answer, Stop)

## Why these decisions exist

- **No database, no auth, no cloud.** Trust boundary is the user's machine. Anything reachable on `127.0.0.1:3200` already controls Claude Code as that user — adding auth on top would be theater.
- **Production mode is the supported runtime.** Reverse proxies (Tailscale, ngrok), service-worker caching, and self-dogfood deploys all expect `npm start`. `npm run dev` exists only for hacking on Control Tower itself.
- **Webpack for dev, not Turbopack.** Turbopack walks the project root and indexes RedEye's `.worktrees/T-N/` clones, ballooning memory past 80 GB (reproduced 3× before the fix). Webpack honors `watchOptions.ignored` in `next.config.ts`. Don't "modernize" by removing `--webpack`.
- **Normal commit history on `main`.** ControlTower used to enforce a single-commit-on-`main` policy with `commit --amend` + `push --force`; that was retired on 2026-04-29. Use ordinary commits, branch off `main` for new feature work, and merge back. RedEye auto-commits land on `main` directly during the autonomous loop and stay as separate commits.

## How to work in here

### Run

```bash
npm install
npm run build && npm start         # supported runtime
npm run dev                        # only when editing Control Tower itself
npx next start --hostname 127.0.0.1 --port 4000  # change the port
```

> `PORT=4000 npm start` does not work — the `npm start` script hardcodes `--port 3200`. Use the `npx next start` form above to override.

### Test

```bash
npm test                           # vitest (unit + component)
npm run typecheck                  # tsc --noEmit
npm run e2e                        # Playwright, against a running prod server
```

Always run `typecheck` and `test` before committing. E2E exercises the prod build, so spin up `npm run build && npm start` in another terminal first.

### Commit & push

- **Branch off `main` for new feature work.** `git checkout -b feat/<topic>`, commit normally, merge back via PR or fast-forward.
- **Stage selectively** (`git add <file>`), not `git add -A`, when other tooling (RedEye) might be writing. `.redeye/`, `.worktrees/`, and `docs/{tasks,inbox,changelog}-archive/` are gitignored, but `git add -A` can still pick up debug artifacts (`.playwright-mcp/` screenshots, etc.).
- **Conventional-commit style** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Keep messages tight; the body is for *why*, not *what*.
- The single-commit-on-`main` policy that this section used to describe was retired on 2026-04-29.

### Where things live

| Want to… | Start at |
|----------|----------|
| Add an API endpoint | `app/api/projects/[id]/<route>/route.ts` |
| Change a parser | `lib/redeye-parsers.ts` + `lib/redeye-files.ts` (+ tests) |
| Touch session lifecycle | `lib/session-manager.ts` |
| Adjust cost math | `lib/cost-calculator.ts`, `lib/cost-history.ts`, `lib/cost-forecast.ts` |
| Change the live transcript tail | `app/api/projects/[id]/stream/route.ts` + `lib/transcript-normalizer.ts` |
| Reskin | `app/globals.css` + `tailwind.config.ts` + `components/` — see UI Redesign section below |
| Add a CLI command | `bin/` + `lib/ct-init-core.mjs` |

## Conventions

### Code

- **TypeScript strict.** No `any` unless you explain why in a comment.
- **`spawn(cmd, [args])` only.** Never shell-string spawning. Same rule for `execFileSync`.
- **Atomic writes** for every `.redeye/*.md` mutation — temp file + `rename` via `atomicWriteJson` (`lib/atomic-write.ts`). All 8 mutating API routes (steer, tasks, tasks/[taskId], schedules, schedules/run, pause, stop, answer) already use this. New routes must too.
- **CSRF-aware API routes.** `proxy.ts` middleware checks `Origin`/`Sec-Fetch-Site`. New API routes inherit this; don't bypass.
- **Path validation** — anything user-supplied that becomes a path goes through `safeRedeyePath` (`lib/redeye-files.ts`) or the `addProject` realpath check (`lib/projects.ts`).
- **Markdown sanitization** via `lib/markdown-sanitize.ts` (DOMPurify + react-markdown). No raw HTML injection anywhere else in components.

### Files & paths

- **Never write `/Users/<name>/` literals** in source, tests, comments, or docs. Use `/tmp/...`, `/home/user/...`, or `<repo>/...` placeholders.
- The path-mangling format Claude uses for transcripts is `~/.claude/projects/<encoded>/` where `<encoded>` is the project path with `/` → `-`. See `lib/transcript-file-resolver.ts`.

### Tests

- Vitest for unit + component.
- Playwright for E2E in `e2e/`. Specs use fixture project paths like `/tmp/haze` — never real local paths.
- TDD when fixing bugs in parsers (`lib/redeye-parsers.ts`) — there are regression tests for section-boundary detection that any change should preserve.

## Things you should NOT do

- ❌ Bypass the CSRF middleware for "convenience"
- ❌ Switch dev to Turbopack (read `next.config.ts` first)
- ❌ Run `git add -A` blindly — `.redeye/`, `.worktrees/`, and `docs/tasks-archive/` are gitignored *and* untracked, but RedEye writes to them while you work
- ❌ Hardcode user paths or usernames in any file
- ❌ Make the README claim multi-tenant, multi-user, or production-grade — Control Tower is single-user-local-only and the README is honest about that
- ❌ Force-push or rewrite history on `main` — the single-commit policy was retired 2026-04-29; `main` is now an ordinary multi-commit branch

## UI Redesign (`ui_redesign` branch)

Phases 1–5 shipped. The home dashboard, the global header, the fleet-wide
activity + inbox pages, the per-project landing page, the five most common
dialogs, and the mobile bottom-tab shell all run on the new design tokens.
The two onboarding wizards (`home-onboarding-wizard`, `onboarding-wizard`)
are still on the legacy UI and will be touched in Phase 6 cleanup.

**Design tokens** (`app/globals.css`):
- oklch token system: background ramps `--bg-0..3`, foreground ramps `--fg-0..3`, line tokens, brand `--red` / `--red-tint`, status accents (`--mint`, `--amber`, `--rose`, `--sky`, `--violet`) each with a `-tint` variant, radii, and shadows.
- Light theme on `:root`, dark on `.dark` (works with the existing ThemeProvider).
- `@theme inline` maps tokens into Tailwind utilities (`bg-bg-0`, `text-fg-1`, etc.) and binds `--font-sans` → Inter, `--font-mono` → JetBrains Mono.
- Legacy `--bg-base` / `--text-primary` tokens kept during migration window.
- Utility classes: `.eyebrow`, `.dot` (+ status variants + `.dot-pulse`), `.chip`, `.btn`, `.card-rd`, `.divider-rd`, `.kbd`, `.pipeline`, `.safe-top`/`.safe-bottom`, `.spark`, `.input-rd`, `.scrollbar-rd`.

**Fonts** (`app/layout.tsx`): Inter (body) and JetBrains Mono (tabular/literal) loaded via `next/font/google`, exposed as `--font-inter` and `--font-jetbrains-mono` on `<html>`.

**`components/redesign/`** — primitives consumed by the new home + activity pages:
- `icon.tsx`, `logo.tsx` — inline SVG primitives.
- `phases.ts`, `phase-pipeline.tsx`, `spark.tsx` — pipeline + sparkline visuals.
- `top-bar.tsx` — global header (logo + title + activity link + bell + theme). Wired into `client-providers.tsx`. Activity links to `/activity`. Bell still uses `useNotificationsContext` and exposes `data-testid="notification-bell"`.
- `fleet-summary.tsx`, `inbox-card.tsx`, `project-card-new.tsx` — desktop home cards.

**API extensions for the home dashboard:**
- `GET /api/projects` now also returns `taskId`, `taskTitle`, `backlogCount`, `doneCount`, `scheduleEnabled`, `scheduleSummary`. Per-project enrichment runs in parallel; `scheduleSummary` is taken from the first SCHED entry's frequency string.
- `GET /api/inbox` aggregates every unanswered question across the fleet. Each row carries a stable `${projectIndex}:${questionId}` `uid` so the home can dedupe across polls.
- `GET /api/activity` aggregates `CHANGELOG.md` from every project, sorts newest-first, capped at 60 entries.

**`/activity`** is the global "what shipped recently" page that the TopBar's activity icon links to. It's a thin client over `/api/activity`.

**`ProjectWithStatus`** (`lib/redeye-types.ts`) gained the new optional fields above. They're additive — older callers that only read `name/path/initialized/running` keep working.

**Per-project shell** (`components/redesign/project-shell.tsx`) wraps every `/project/[id]/*` route with a project bar (back link · status dot · name · path) and a 3-tab nav (Now / Tasks / History) — replacing the previous 6-tab `ProjectNav`. The legacy `/project/[id]/{steer,live,schedules}` routes still exist (URL-accessible from the Now view's controls and schedule cards) but they're no longer in the nav and will be replaced by modals in Phase 4. The `Tasks` tab badge reads `backlogCount` from `/api/projects/[id]`'s `upNext` (filtered for `pending` + `planned`).

**Now view** (`app/project/[id]/now-client.tsx`) replaces `mission-control-client.tsx`. Two-column layout: hero working-on card with phase pipeline, questions banner, up next + recently shipped, live transcript pointer (full tail still lives at `/live`); right rail with Controls (Start/Stop/Pause/Steer/Add task), Schedule card, and Health card. Cost-tracking, phase notifications, and keyboard shortcuts all preserved.

Tasks and History clients still render their legacy bodies — only their page-level `<PageHeader>` was stripped so it doesn't double-up with the shell's project bar. Phase 6 will redesign their internals.

**Modals (Phase 4)** — five Radix-Dialog-based modals were re-skinned onto
the new tokens (`.card-rd`, `.input-rd`, `.btn`, oklch overlay, `Icon` close
button, `eyebrow` label):
- `components/answer-modal.tsx`
- `components/add-project-dialog.tsx`
- `components/add-task-dialog.tsx`
- `components/steer-dialog.tsx`
- `components/schedules/add-schedule-dialog.tsx`

Each kept its existing form-state, validation, fetch, and aria-labels
unchanged — only the surface markup moved. Tests still pass.

**Mobile shell (Phase 5):**
- `components/redesign/mobile-tab-bar.tsx` — sticky bottom tab bar, hidden
  on `md:` and up via `.mobile-only`. Tabs: Home (`/`), Inbox (`/inbox`),
  Live (project-scoped — links to `/project/[id]/live` only when on a
  project route, otherwise renders disabled), Settings (greyed-out
  placeholder). Mounted globally inside `ClientProviders`.
- `app/inbox/{page,inbox-client}.tsx` + `metadata.title = "Inbox"` — the
  global inbox page that the mobile bar links to. Reuses `<InboxCard>` and
  the existing `<AnswerModal>`.
- `app/globals.css`: `.mobile-only` / `.desktop-only` utilities at the
  Tailwind `md` (768 px) breakpoint, plus a body bottom-padding rule that
  reserves `56 px + safe-area-inset-bottom` so scrollable content isn't
  hidden behind the tab bar in iOS PWA standalone.
- Responsive collapse: `FleetSummary` flips its 5-stat row to a column on
  mobile (and the divider hairlines flip orientation accordingly); the
  `NowClient` 2-column shell collapses to a single column; the up-next +
  recently-shipped grid stacks too.

Phase 6 will redesign the onboarding wizards, retire dead code (the
unrouted `mission-control-client.tsx` and the legacy `ProjectNav`), and
add Playwright coverage for the new flows.

## Pointers

- [README.md](README.md) — user-facing pitch, install, usage
- [ARCHITECTURE.md](ARCHITECTURE.md) — code map, request flows, invariants
- [CONTRIBUTING.md](CONTRIBUTING.md) — issue/PR conventions
- [SECURITY.md](SECURITY.md) — vulnerability disclosure
- `lib/CLAUDE.md` — domain-logic specifics
- `e2e/CLAUDE.md` — Playwright conventions
