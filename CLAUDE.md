# Control Tower

Next.js 16 App Router dashboard for managing and monitoring RedEye AI coding agents. Runs at `http://localhost:3200`.

## Commands

- **Dev:** `npm run dev` — invokes `next dev --webpack` (see "Dev bundler" below; do NOT change to Turbopack). **Local-only** — see "Tailscale needs prod" below.
- **Build:** `npm run build` — uses Turbopack (production builds are fine; no watcher)
- **Start (prod):** `npm run start` — required when serving over Tailscale (see below)
- **Unit tests:** `npm test` (vitest)
- **E2E:** `npm run e2e` (Playwright)
- **Typecheck:** `npm run typecheck`

## Tailscale needs prod

When CT is exposed via `tailscale serve` (so the dashboard is reachable from a phone or other tailnet device), use prod mode (`npm run build && npm run start`). Dev mode does **not** work over Tailscale because Next.js HMR uses a long-lived WebSocket at `/_next/webpack-hmr`, and `tailscale serve` drops WebSocket connections every 10–40 s with close code 1001 ("Going Away") — see [tailscale/tailscale#18827](https://github.com/tailscale/tailscale/issues/18827). The home page hangs on "Loading projects" or shows "0 projects registered" because hydration stalls when HMR can't keep its socket. Local dev (`http://127.0.0.1:3200`) is unaffected and works normally.

There is no `tailscale funnel` workaround that preserves tailnet-only access. The accepted tradeoff: dev for local iteration, prod for tailnet access. There is **no** prod auto-rebuild watcher in this repo by design — re-deploy explicitly with `npm run build && npm run start` after merging changes you want to see live.

## Dev bundler

`npm run dev` runs on **webpack**, not Turbopack — this is intentional. Next.js 16 defaults to Turbopack for dev, but Turbopack walks the entire project root with no documented directory-exclude API. RedEye's `.worktrees/T-N/` and Claude Code's `.claude/worktrees/agent-*/` are full project-tree clones inside the project root; Turbopack indexes them recursively and the in-memory module graph balloons past 80 GB (reproduced three times before the fix). Webpack honors `watchOptions.ignored`, which `next.config.ts` uses to mask both worktree directories.

**If you find this and want to "modernize" by removing `--webpack`: don't.** Read `next.config.ts` first — the rationale is documented inline.

References: `vercel/turborepo#8765`, `vercel/next.js#80665`.

## Architecture

**Pages** (`app/`) — App Router, all server components unless marked `'use client'`
- `/` — Home: project cards with live phase/task status
- `/project/[id]` — Mission control: Working On, Controls, Cost, Questions, Recently Shipped cards
- `/project/[id]/tasks` — Task list with in-progress item pinned at top
- `/project/[id]/tasks/[taskId]` — Task detail
- `/project/[id]/live` — SSE transcript tail
- `/project/[id]/history` — Session history

**API routes** (`app/api/projects/`) — REST handlers for start/stop/restart/pause/steer/answer/init, task CRUD, cost, sessions, SSE stream

**Core lib** (`lib/`) — All business logic; no framework coupling
- `session-manager.ts` — spawn/kill claude processes; calls `pruneOrphanWorktrees` on start/stop
- `redeye-files.ts` / `redeye-parsers.ts` — read/write `.redeye/` files
- `cost-calculator.ts` — parse JSONL transcripts for cost_usd; mtime+size memo
- `cost-history.ts` — fused single-pass scan over transcripts
- `transcript-file-resolver.ts` — locate Claude transcript files in `~/.claude/projects/`
- `worktree-pruner.ts` — removes orphan worktrees whose lock-PID is dead
- `claude-runner.ts` — spawns Claude Code; rotates session log at 5 MB
- `promise-pool.ts` — order-preserving bounded concurrency
- `stream-utils.ts` — SSE helpers
- `task-id.ts` — `getNextTaskId()` — always use this to assign task IDs

**Components** (`components/`) — UI cards and dialogs; dark/light mode via next-themes

## Key Constraints

- Task IDs: always use `getNextTaskId(projectPath)` from `lib/task-id.ts` — never hardcode or increment manually
- Cost invariant: `totalCost >= sessionCost` — enforced in `cost/route.ts` via `Math.max`
- Session lifecycle: process start/restart goes through `session-manager.ts`; stop and pause write directives to `.redeye/steering.md` (no process kill — CTO exits at next boundary)
- Transcript source: Claude's own `~/.claude/projects/-Users-casa-{slug}/*.jsonl` files, not `.redeye/` JSONL
- Dev mode is webpack (see above); production build uses Turbopack
