# Control Tower

Next.js 15 App Router dashboard for managing and monitoring RedEye AI coding agents. Runs at `http://localhost:3200`.

## Commands

- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Unit tests:** `npx vitest run`
- **E2E:** Playwright via MCP browser (no CLI command configured)

## Architecture

**Pages** (`app/`) — App Router, all server components unless marked `'use client'`
- `/` — Home: project cards with live phase/task status
- `/project/[id]` — Mission control: Working On, Controls, Cost, Questions, Recently Shipped cards
- `/project/[id]/backlog` — Backlog list with in-progress item pinned at top
- `/project/[id]/backlog/[taskId]` — Backlog item detail
- `/project/[id]/live` — SSE transcript tail
- `/project/[id]/history` — Session history

**API routes** (`app/api/projects/`) — REST handlers for start/stop/restart/pause/steer/answer/init, backlog CRUD, cost, sessions, SSE stream

**Core lib** (`lib/`) — All business logic; no framework coupling
- `session-manager.ts` — spawn/kill claude processes
- `redeye-files.ts` / `redeye-parsers.ts` — read/write `.redeye/` files
- `cost-calculator.ts` — parse JSONL transcripts for cost_usd
- `transcript-file-resolver.ts` — locate Claude transcript files in `~/.claude/projects/`
- `stream-utils.ts` — SSE helpers
- `backlog-id.ts` — `getNextBacklogId()` — always use this to assign BL IDs

**Components** (`components/`) — UI cards and dialogs; dark/light mode via next-themes

## Key Constraints

- Backlog IDs: always use `getNextBacklogId(projectPath)` from `lib/backlog-id.ts` — never hardcode or increment manually
- Cost invariant: `totalCost >= sessionCost` — enforced in `cost/route.ts` via `Math.max`
- Session lifecycle: process start/restart goes through `session-manager.ts`; stop and pause write directives to `.redeye/steering.md` (no process kill — CTO exits at next boundary)
- Transcript source: Claude's own `~/.claude/projects/-Users-casa-{slug}/*.jsonl` files, not `.redeye/` JSONL

## RedEye State

Tracked in `.redeye/` — not committed alongside code:
- `state.json` — current phase, active BL item, counters (`next_bl_id`: 26)
- `backlog.md` — all backlog items; 20 done, 6 planned (BL-020–025)
- `config.md` — project config and role definitions

**Backlog summary (as of iteration 44):**
- Done: BL-001–019, BL-021, BL-031, BL-034, BL-035, BL-036
- Planned: BL-020 (cost-per-item), BL-022 (API unit tests, P1), BL-023 (home page polling, P2), BL-024 (aria-labels, P2), BL-025 (try-catch API routes, P1)
- Current phase: TRIAGE (post-HARDEN)
