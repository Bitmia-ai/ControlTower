# Control Tower — Design Spec

**Date:** 2026-04-23
**Status:** Approved (brainstorming complete)
**Repo:** Bitmia-ai/control-tower (separate from RedEye)

---

## What is Control Tower?

A web-based orchestration system for RedEye. Manages RedEye sessions across multiple projects from a browser. Start, stop, monitor, steer, and interact with your autonomous dev agents — without touching the terminal.

Think of it as the flight control dashboard for your RedEye fleet.

## Core Principles

- **Stateless** — no database. Reads `.redeye/` files directly. Session logs in `.jsonl` files.
- **Writes go through Claude** — backlog, steering, inbox answers, init, start, stop, pause all pipe through Claude via RedEye plugin commands. Control Tower never writes to `.redeye/` files directly.
- **One instance per project** — no multi-instance complexity. One CTO loop, one UX Tester, one Documenter per project.
- **Cloud-ready architecture** — detached processes + `.jsonl` log files. Future: local bridge + cloud Control Tower.

---

## Architecture

```
Control Tower (Next.js 15 · localhost:3100)
│
├── reads .redeye/ files directly (status, backlog, inbox, etc.)
├── reads .redeye/session-*.jsonl for live transcript streaming
├── reads ~/.redeye/config.json for project list
│
├── writes via Claude (Sonnet):
│   ├── /redeye:backlog  → .redeye/backlog.md
│   ├── /redeye:steer    → .redeye/steering.md
│   ├── /redeye:status   → .redeye/inbox.md (answer questions)
│   ├── /redeye:pause    → .redeye/steering.md
│   └── /redeye:stop     → .redeye/steering.md
│
├── session management via Claude:
│   ├── /redeye:init     → onboarding wizard
│   └── /redeye:start    → creates loop files + begins CTO loop
│
└── per project, spawns up to 3 Claude sessions:
    ├── CTO Loop     (claude --print --output-format stream-json --model opus --plugin-dir ~/redeye)
    ├── UX Tester    (claude --print --output-format stream-json --model sonnet --plugin-dir ~/redeye)
    └── Documenter   (claude --print --output-format stream-json --model sonnet --plugin-dir ~/redeye)
```

### Process Management

- Sessions spawned as detached child processes via `child_process.spawn()`
- Output piped to `.redeye/session-{role}.jsonl` (one file per session type)
- PIDs tracked in memory (not persisted — if Control Tower restarts, it re-scans for running processes)
- SSE (Server-Sent Events) streams `.jsonl` file changes to the browser in real-time
- Stop: sends `/redeye:stop` via Claude, then monitors process. Force-kill after 60s timeout.

### Claude Command Interface

All writes from Control Tower go through short-lived Claude sessions:

```bash
echo "Add dark mode support to the backlog" | claude --print --output-format stream-json --model sonnet --plugin-dir ~/redeye -p "/redeye:backlog add: dark mode support"
```

The Sonnet session runs the RedEye command, which formats and commits the change. Control Tower reads the JSON output to confirm success or show errors.

---

## Pages

### 1. Home — Global Mission Control (`/`)

Card per project showing at-a-glance status:

| Info | Source |
|------|--------|
| Project name | `~/.redeye/config.json` |
| Current task (title, not BL-xxx) | `.redeye/state.json` → `backlog_title` |
| Phase (human-readable) | `.redeye/state.json` → `phase` |
| Health indicator (green/yellow/red) | `.redeye/state.json` → `health.confidence` |
| Pending questions count | `.redeye/state.json` → `health.questions_awaiting_ceo` |
| Running/Stopped status | Process scan (PID check) |

**Actions from home:**
- Click project → project mission control
- "Add Project" button → directory picker / path input
- Start/Stop toggle per project

### 2. Project Mission Control (`/project/:id`)

Card grid layout. All critical info on one page, no tabs needed for the essentials.

**Cards:**

| Card | Content | Source |
|------|---------|--------|
| **Working On** | Current task title, phase (human-readable), time since last activity | `.redeye/state.json`, `.redeye/status.md` |
| **Health** | Green/yellow/red indicator, test count, build status, items shipped count | `.redeye/state.json`, `.redeye/changelog.md` |
| **Questions** (prominent, red border when pending) | Pending questions with preview text, "Answer" button per question | `.redeye/inbox.md` |
| **Up Next** | Next 2-3 backlog items by priority (title only, not BL-xxx) | `.redeye/backlog.md` |
| **Recently Shipped** | Last 3-5 completed items with checkmarks | `.redeye/changelog.md` or `.redeye/backlog.md` (done items) |
| **Controls** | Start / Stop / Pause buttons, Steer button, Add to Backlog button | Process management + Claude commands |

**Question card behavior:**
- When questions are pending: card has red border (#DC2626), spans full width
- Shows question text preview
- "Answer" button opens the Answer Modal

**Controls:**
- Start → spawns Claude via `/redeye:start`
- Stop → sends `/redeye:stop`, monitors, force-kills after timeout
- Pause → sends `/redeye:pause` via Claude
- Steer → opens text input, pipes through Claude via `/redeye:steer`
- Add to Backlog → opens quick-add input with optional expand for details, pipes through Claude via `/redeye:backlog`

### 3. Full Backlog (`/project/:id/backlog`)

Complete view of `.redeye/backlog.md`:
- CEO Requests, Discovered, Triaged sections
- Status badges (pending, planned, in progress, done, blocked)
- Quick-add at top (same as project mission control, pipes through Claude)
- No inline editing — all changes go through Claude

### 4. History (`/project/:id/history`)

Changelog + activity timeline:
- Parsed from `.redeye/changelog.md`
- Shows what was built, review findings, test counts
- Reverse chronological

### 5. Live Transcript (`/project/:id/live`)

Streaming view of the current session output:
- Reads from `.redeye/session-cto.jsonl` via SSE
- Renders JSON events as cards: text output, tool calls, thinking, errors
- Auto-scrolls to bottom
- Collapsible tool call details
- Secondary view for UX Tester and Documenter transcripts

---

## Onboarding Wizard

Triggered when user adds a project that doesn't have `.redeye/` initialized.

### Flow:

1. **Welcome** — "Let's set up RedEye for {project-name}"
2. **Vision** — "What are you building? Describe it in a sentence or two."
   - Text area, placeholder: "A beautiful terminal weather CLI..."
3. **First Tasks** — "What should RedEye build first?"
   - Quick-add field, can add multiple items
   - Each item gets a preview card below
4. **Commands** — "How do you build and test?"
   - Deploy command (text input, placeholder: "npm run build")
   - Test command (text input, placeholder: "npm test")
   - App URL (text input, placeholder: "http://localhost:3000")
5. **Review** — summary of all inputs before confirming
6. **Initialize** — pipes all answers to Claude via `/redeye:init`
   - Shows progress as Claude creates files
   - Redirects to project mission control when done

### Design notes:
- Step-by-step, not a giant form
- Each step is one question, big input area
- Back button to revise previous steps
- Skip button for optional fields (deploy/test commands)

---

## Answer Modal

Opened when user clicks "Answer" on a question card.

### Content:
- **Question text** (full, from `.redeye/inbox.md`)
- **Context** — what RedEye was working on when it asked (backlog item title, phase)
- **Default chosen** — if RedEye proceeded with a default, show what it chose
- **Suggested answers** — if the question includes options, show them as clickable buttons
- **Free-text input** — for custom answers
- **Submit** — pipes answer through Claude via `/redeye:status` → answer flow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript 5.7 |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Components | Radix UI (dialog, switch, label) |
| Icons | Lucide React |
| Markdown rendering | react-markdown + remark-gfm |
| Class merging | tailwind-merge |
| Unit tests | Vitest 4 + Testing Library |
| E2E tests | Playwright |
| Process management | Node.js child_process |
| Real-time streaming | SSE (Server-Sent Events) |
| Theme | Dark (zinc-900/950), red accent (#DC2626) |

---

## Data Flow

### Reads (direct file access from API routes)

```
GET /api/projects           → reads ~/.redeye/config.json
GET /api/projects/:id       → reads .redeye/state.json, status.md, backlog.md, inbox.md, changelog.md
GET /api/projects/:id/stream → SSE from .redeye/session-cto.jsonl (fs.watch + tail)
```

### Writes (via Claude Sonnet)

```
POST /api/projects/:id/backlog  → spawns claude --model sonnet, sends /redeye:backlog
POST /api/projects/:id/steer    → spawns claude --model sonnet, sends /redeye:steer
POST /api/projects/:id/answer   → spawns claude --model sonnet, sends /redeye:status + answer flow
POST /api/projects/:id/pause    → spawns claude --model sonnet, sends /redeye:pause
POST /api/projects/:id/stop     → spawns claude --model sonnet, sends /redeye:stop
```

### Session Management

```
POST /api/projects/:id/start    → spawns claude --model opus for CTO loop (detached)
POST /api/projects/:id/stop     → sends stop command, monitors PID, force-kill after 60s
GET  /api/projects/:id/sessions → returns running session PIDs and status
POST /api/projects/add          → adds to ~/.redeye/config.json
POST /api/projects/:id/init     → spawns claude --model sonnet for /redeye:init wizard
```

---

## File Structure

```
control-tower/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home — global mission control
│   │   ├── layout.tsx                  # Root layout (dark theme, sidebar)
│   │   ├── project/
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Project mission control (card grid)
│   │   │       ├── backlog/page.tsx    # Full backlog view
│   │   │       ├── history/page.tsx    # Changelog timeline
│   │   │       └── live/page.tsx       # Live transcript stream
│   │   └── api/
│   │       ├── projects/
│   │       │   ├── route.ts            # GET list, POST add
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET project detail
│   │       │       ├── start/route.ts  # POST start session
│   │       │       ├── stop/route.ts   # POST stop session
│   │       │       ├── backlog/route.ts # POST add to backlog
│   │       │       ├── steer/route.ts  # POST add directive
│   │       │       ├── answer/route.ts # POST answer question
│   │       │       ├── pause/route.ts  # POST pause
│   │       │       ├── init/route.ts   # POST initialize project
│   │       │       ├── sessions/route.ts # GET running sessions
│   │       │       └── stream/route.ts # GET SSE transcript stream
│   ├── components/
│   │   ├── project-card.tsx            # Home page project card
│   │   ├── mission-control/
│   │   │   ├── working-on-card.tsx     # Current task card
│   │   │   ├── health-card.tsx         # Health status card
│   │   │   ├── questions-card.tsx      # Inbox questions card
│   │   │   ├── up-next-card.tsx        # Next backlog items
│   │   │   ├── shipped-card.tsx        # Recently completed
│   │   │   └── controls-card.tsx       # Start/stop/pause/steer
│   │   ├── answer-modal.tsx            # Question answer modal
│   │   ├── add-backlog-dialog.tsx      # Add to backlog dialog
│   │   ├── steer-dialog.tsx            # Add steering directive
│   │   ├── onboarding-wizard.tsx       # Init wizard (multi-step)
│   │   ├── add-project-dialog.tsx      # Add project dialog
│   │   ├── transcript-viewer.tsx       # Live JSON stream renderer
│   │   └── phase-badge.tsx             # Phase display badge
│   └── lib/
│       ├── redeye-files.ts             # Read .redeye/ control files
│       ├── redeye-parsers.ts           # Parse markdown → structured data
│       ├── redeye-types.ts             # TypeScript types
│       ├── claude-runner.ts            # Spawn claude, parse JSON stream
│       ├── session-manager.ts          # Manage running sessions (PIDs, spawn, kill)
│       ├── projects.ts                 # Project config CRUD
│       └── stream-utils.ts             # SSE helpers, jsonl tail
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── vitest.config.ts
```

---

## UI Details

### Theme
- Background: zinc-950 (#09090b)
- Card background: zinc-900 (#18181b)
- Border: zinc-800 (#27272a)
- Text primary: zinc-100
- Text secondary: zinc-400
- Accent: red-600 (#DC2626)
- Success: green-500 (#22c55e)
- Warning: amber-500 (#f59e0b)

### No iterations in UI
- Never show iteration numbers
- Show phase as human-readable text: "Building", "Reviewing", "Deploying", "Verifying", "Planning"
- Show time-based info: "started 12 min ago", "last activity 3 min ago"

### Auto-refresh
- Project mission control polls every 5 seconds for file changes
- SSE stream for live transcript (real-time)
- Home page polls every 10 seconds

---

## Future (not in v1)

- **Settings page** — edit vision, deploy commands, test commands, app URL via UI (may need `/redeye:configure` plugin command)
- **Telegram integration** — receive notifications and control RedEye from Telegram
- **Cloud deployment** — Control Tower in the cloud with local bridge
- **Multiple users** — auth, permissions, team view
- **UX Tester controls** — start/stop/configure the UX tester session independently
- **Documenter controls** — same for documenter
- **Cost tracking** — show token spend per project from JSON stream usage data
