# Architecture

A guide to how Control Tower is built. Read this if you're poking at the source for the first time.

## Bird's-eye view

Control Tower is a **single-user, local-only Next.js dashboard** with no database. It is a thin stateless UI on top of the markdown files [RedEye](https://github.com/Bitmia-ai/RedEye) writes into each project's `.redeye/` directory.

```
┌────────────────────────────────────────────────┐
│ Browser (PWA, http://localhost:3200)           │
│ ┌────────┐ ┌────────────┐ ┌─────────┐ ┌──────┐ │
│ │ Home   │ │ Mission    │ │ Tasks / │ │ Live │ │
│ │ (list) │ │ Control    │ │ History │ │ tab  │ │
│ └────────┘ └────────────┘ └─────────┘ └──────┘ │
└──────────────────────┬─────────────────────────┘
                       │  REST + SSE
                       ▼
┌────────────────────────────────────────────────┐
│ Next.js server (App Router, Node runtime)      │
│  app/api/projects/...                          │
│   ├── reads/writes .redeye/*.md per request    │
│   ├── spawns Claude Code subprocess            │
│   └── tails JSONL transcripts to SSE clients   │
└──────────────────────┬─────────────────────────┘
                       │
        ┌──────────────┼─────────────────┐
        ▼              ▼                 ▼
   ~/.redeye/     project/.redeye/   ~/.claude/projects/
   config.json    *.md, state.json   *.jsonl (transcripts)
```

Three things to keep in mind everywhere:

- **No database.** State lives in markdown + JSON files on disk, plus a few in-memory `Map`s for the running process registry.
- **Reads on every poll, writes only on user action.** API routes never write `.redeye/*` opportunistically. Only Add Task, Steer, Answer, and Stop write files.
- **Local-only.** Server binds to `127.0.0.1`. No auth. Tunnel in (SSH, Tailscale) for remote access.

## Code map

### `app/` — Next.js App Router

- `page.tsx` — home (project list + cards)
- `project/[id]/` — per-project tabs (`page.tsx` mission control, `tasks/`, `tasks/[taskId]/`, `history/`, `live/`, `schedules/`, `steer/`)
- `offline/page.tsx` — PWA offline fallback
- `manifest.ts` — PWA manifest

### `app/api/projects/...` — REST + SSE endpoints

Each subdirectory mounts at `/api/projects/[id]/<name>`:

| Route | What it does |
|-------|--------------|
| `route.ts` | `GET` project state, `PATCH` rename/path |
| `start`, `restart` | Session lifecycle — spawn / restart |
| `stop` | Writes STOP directive to `steering.md` AND calls `stopSession()` (SIGTERM → SIGKILL). Not graceful-only. |
| `pause` | Writes PAUSE directive only; does not kill the process. |
| `force-stop` | Immediate SIGKILL, no directive written. |
| `tasks/` | Task CRUD (writes to `.redeye/tasks.md`) |
| `steer` | Append directive to `.redeye/steering.md` |
| `answer` | Append answer to `.redeye/inbox.md`; inbox r/m/w and `state.json` counter update both run inside `withProjectLock` |
| `init` | Run `/redeye:init` in a fresh repo |
| `stream` | **SSE**: tails the active Claude transcript JSONL |
| `transcript-status` | Health of the transcript-file resolver |
| `session-history`, `sessions` | Past CTO sessions for the project |
| `cost`, `cost-history`, `cost-forecast`, `cost-snapshot`, `cost-start` | Cost aggregation, snapshots, forecasting |
| `velocity` | Velocity chart data |
| `schedules`, `schedules/[schedId]`, `schedules/run` | Recurring tasks |

### `lib/` — domain logic, parsers, runtime

| File | Responsibility |
|------|----------------|
| `projects.ts` | Project registry (`~/.redeye/config.json`). Add/remove/list. |
| `redeye-files.ts` | High-level reads of `.redeye/*.md` for a project. |
| `redeye-parsers.ts` | Markdown parsers: tasks, changelog, inbox. Section-boundary aware. |
| `redeye-types.ts` | TypeScript types for parsed RedEye state. |
| `session-manager.ts` | In-memory registry of running CTO processes. Spawn / track / SIGTERM / SIGKILL / stall detection / auto-restart. `isProjectIdle()` gates respawn so watchdog honors intentional STOP. `PROMPTS` is exported with a contract test. |
| `claude-runner.ts` | Wraps `spawn('claude', [...])` for one-shot or interactive runs. |
| `transcript-file-resolver.ts` | Maps a project path to its most recent `~/.claude/projects/<encoded>/*.jsonl`. |
| `transcript-normalizer.ts` | Reduces JSONL events to a UI-friendly timeline. |
| `cost-calculator.ts` | Aggregates `cost_usd` from a transcript. |
| `cost-history.ts` | Per-task cost snapshots, taken at `done` transitions. |
| `cost-forecast.ts` | Predicts remaining cost from velocity and per-task averages. |
| `git-commit-push.ts` | Local git operations (commit only, never push). |
| `markdown-sanitize.ts` | DOMPurify wrapper for rendering RedEye-authored markdown safely. |
| `notification-store.ts` | In-memory notification queue surfaced via the bell drawer. |
| `task-duration.ts`, `task-badge-styles.ts`, `task-id.ts` | Task UI helpers. |
| `process-utils.ts` | Process-existence helpers extracted from `session-manager` and `worktree-pruner`. |
| `fetch-utils.ts` | `fetchJsonWithTimeout` helper extracted from mission-control cards. |
| `state-mutex.ts` | Per-project async mutex (`withProjectLock`). Used by `answer/route.ts` to serialize inbox + state.json writes. |
| `format-relative-time.ts`, `scroll-utils.ts`, `stream-utils.ts`, `atomic-write.ts`, `json-body.ts`, `promise-pool.ts` | Generic utilities. |
| `use-*.ts(x)` | React hooks (notifications, list filters, keyboard shortcuts, phase-change toasts). |
| `theme-context.tsx` | Dark/light theme provider. |
| `ct-init-core.mjs` | CLI scaffolder used by `npx control-tower init`. |

### `components/` — React UI

- `mission-control/` — the per-project cards (Working On, Cost, Questions, Up Next, Velocity, Health, Recently Shipped, Sparkline)
- `history/` — session history rows + phase chips
- `schedules/` — schedule list and add-schedule dialog
- Top-level dialogs: `add-task-dialog`, `add-project-dialog`, `answer-modal`, `steer-dialog`
- `page-header.tsx` — shared page header extracted from Tasks, Schedules, and History page clients
- PWA bits: `install-banner`, `service-worker-registrar`, `offline-banner`
- Generic primitives: `notification-bell`, `notification-drawer`, `markdown-renderer`, `pagination`, `theme-toggle`, `toast-provider`, `transcript-viewer`

### `bin/` — CLI

- `control-tower.mjs` — `npx control-tower` launcher
- `ct-init.mjs` — `npx control-tower init` scaffolder

### `scripts/` — build helpers

- `patch-next.mjs` — patches a known Next.js dev quirk
- `digest.sh` — utility for the test suite

### `proxy.ts` + `next.config.ts`

- `proxy.ts` — minimal CSRF-checking middleware for API routes
- `next.config.ts` — `webpack.watchOptions.ignored` masks `.worktrees/` and Claude Code worktrees out of the dev watcher (see [README → FAQ](README.md#faq) for the 80 GB story)

## High-level flows

### Starting a session

1. User clicks **Start** on the home or mission-control page
2. `POST /api/projects/[id]/start` calls `session-manager.spawn(project)`
3. `session-manager` calls `claude-runner.spawn` with `claude --plugin-dir ~/redeye --dangerously-skip-permissions /redeye:start`
4. The CTO subprocess inherits the project's working directory and writes its transcript to `~/.claude/projects/<encoded-path>/<uuid>.jsonl`
5. `session-manager` registers the PID + JSONL path in its in-memory `Map`

### Live tab tail

1. `GET /api/projects/[id]/stream` opens an SSE connection
2. Server resolves the active transcript via `transcript-file-resolver`
3. Tails the JSONL, normalizes each event with `transcript-normalizer`, streams to the browser
4. Browser renders tool calls, thoughts, and inter-round messages as a timeline; `upsertByKey` (exported from `live-client.tsx`) deduplicates stream-replay events on reconnect

### Cost tracking

1. Each transcript JSONL event includes `cost_usd`
2. `cost-calculator` sums by session/task
3. When a task transitions to `done`, `cost-history.snapshot()` records the per-task total
4. `cost-forecast` uses recent velocity + per-task averages to estimate remaining backlog cost

### Polling vs writes

The dashboard polls every 5 seconds (notifications) or on tab activate (most state). API routes **never** write `.redeye/*` on a poll — they only read. Writes happen exclusively in response to explicit user actions (Add Task, Steer, Answer) or session lifecycle commands (Start, Stop).

## Invariants

These do not change without a deliberate architectural decision:

- **No database.** All durable state is markdown + JSON on disk.
- **Single-user.** No auth, no multi-tenancy. The browser tab and the server share trust.
- **Server binds to `127.0.0.1` only.** Public exposure is out of scope; tunnel in via SSH or Tailscale.
- **No shell-string spawning.** Every subprocess uses `spawn(cmd, [args])` with array form.
- **No remote git pushes.** `git-commit-push.ts` only commits; pushing is the user's job.
- **Production mode is the supported runtime.** `npm run dev` exists for hacking on Control Tower itself; reverse proxies and self-dogfood deploys both require `npm start`.

## Testing

- **Vitest** for unit and component tests (`*.test.ts(x)`)
- **Playwright** for E2E (`e2e/`) — exercised against a running prod server
- See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the suite

## Where to look for what

| You want to… | Start at |
|--------------|----------|
| Add a new API endpoint | `app/api/projects/[id]/<your-route>/route.ts` |
| Change how `tasks.md` is parsed | `lib/redeye-parsers.ts` + tests |
| Tweak the mission-control layout | `components/mission-control/` + `app/project/[id]/mission-control-client.tsx` |
| Adjust session lifecycle | `lib/session-manager.ts` |
| Change cost math | `lib/cost-calculator.ts` |
| Touch the live tab | `app/api/projects/[id]/stream/route.ts` + `lib/transcript-normalizer.ts` |
| Reskin the dashboard | `app/globals.css` + `tailwind.config.ts` |

## Why this convention

Inspired by [matklad's ARCHITECTURE.md](https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html). The README sells the project. This file explains it. Keep them separate.
