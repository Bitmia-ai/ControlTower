# Control Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based orchestration dashboard for RedEye that manages sessions across multiple projects

**Architecture:** Stateless Next.js 15 app. Reads `.redeye/` files directly, writes through Claude CLI, manages Claude processes as detached children, streams output via SSE.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide, Vitest, Playwright

**Reference code:** ~/autopilot-companions/dashboard/ (old dashboard, use for patterns)

---

## Phase 1: Project Scaffold + Core Library

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.gitignore`

- [ ] **Step 1: Create Next.js project**
```bash
cd ~/control-tower
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --turbopack
```
Then move to src/ structure if not already there.

- [ ] **Step 2: Install dependencies**
```bash
npm install @radix-ui/react-dialog @radix-ui/react-switch @radix-ui/react-label lucide-react react-markdown remark-gfm tailwind-merge
npm install -D vitest @testing-library/react @vitest/coverage-v8 @playwright/test happy-dom
```

- [ ] **Step 3: Configure dark theme in layout.tsx**
Root layout with zinc-950 background, dark mode default. Include the global CSS setup for Tailwind 4.

- [ ] **Step 4: Create placeholder home page**
Simple page that says "Control Tower" with the red accent color.

- [ ] **Step 5: Verify dev server runs**
```bash
npm run dev
# Open http://localhost:3100, verify dark page renders
```

- [ ] **Step 6: Commit**
```bash
git init && git add -A && git commit -m "feat: scaffold Next.js project with dark theme"
```

### Task 2: TypeScript types

**Files:**
- Create: `src/lib/redeye-types.ts`

- [ ] **Step 1: Define all types**
Types needed:
- `Project` — name, path, initialized, running status
- `RedEyeState` — parsed from state.json (phase, backlog_item, backlog_title, health, counters)
- `BacklogItem` — id, title, type, priority, status, details
- `InboxQuestion` — id, question, default, options, answered, context
- `SteeringDirective` — text, timestamp
- `ChangelogEntry` — title, details, date
- `SessionInfo` — role (cto/tester/documenter), pid, status, logFile
- `ProjectDetail` — project + state + backlog summary + inbox summary + recent changelog
- `ClaudeStreamEvent` — type (system/assistant/user/result), content, usage

Reference: ~/autopilot-companions/dashboard/src/lib/autopilot-types.ts for patterns

- [ ] **Step 2: Commit**

### Task 3: File readers + parsers

**Files:**
- Create: `src/lib/redeye-files.ts`
- Create: `src/lib/redeye-parsers.ts`
- Create: `src/lib/redeye-files.test.ts`
- Create: `src/lib/redeye-parsers.test.ts`

- [ ] **Step 1: Write tests for parsers**
Test parsing of:
- state.json → RedEyeState
- backlog.md → BacklogItem[]
- inbox.md → InboxQuestion[]
- changelog.md → ChangelogEntry[]
- steering.md → SteeringDirective[]
Use fixture strings (not real files).

- [ ] **Step 2: Implement parsers**
Markdown parsing with regex for backlog sections, inbox questions, changelog entries.
Reference: ~/autopilot-companions/dashboard/src/lib/autopilot-parsers.ts

- [ ] **Step 3: Write tests for file readers**
Test reading from a temp `.redeye/` directory.

- [ ] **Step 4: Implement file readers**
Functions: `readState(projectPath)`, `readBacklog(projectPath)`, `readInbox(projectPath)`, `readChangelog(projectPath)`, `readSteering(projectPath)`, `readStatus(projectPath)`, `readProjectDetail(projectPath)`.

- [ ] **Step 5: Run tests**
```bash
npx vitest run
```

- [ ] **Step 6: Commit**

### Task 4: Project config management

**Files:**
- Create: `src/lib/projects.ts`
- Create: `src/lib/projects.test.ts`

- [ ] **Step 1: Write tests**
Test: listProjects, addProject, removeProject. Uses ~/.redeye/config.json.

- [ ] **Step 2: Implement**
Read/write ~/.redeye/config.json. Validate project paths exist.

- [ ] **Step 3: Commit**

### Task 5: Claude runner

**Files:**
- Create: `src/lib/claude-runner.ts`
- Create: `src/lib/claude-runner.test.ts`

- [ ] **Step 1: Implement claude-runner**
Functions:
- `runClaudeCommand(projectPath, command, model?)` — spawns `claude --print --output-format stream-json --model {model} --plugin-dir ~/redeye -p "{command}"` in the project directory. Returns parsed JSON events.
- `spawnClaudeSession(projectPath, role, prompt, model?)` — spawns a long-running detached Claude process, pipes output to `.redeye/session-{role}.jsonl`. Returns PID.
- `parseStreamEvent(line)` — parses a single JSONL line into ClaudeStreamEvent.

- [ ] **Step 2: Write tests** (mock child_process for unit tests)

- [ ] **Step 3: Commit**

### Task 6: Session manager

**Files:**
- Create: `src/lib/session-manager.ts`
- Create: `src/lib/session-manager.test.ts`

- [ ] **Step 1: Implement session manager**
Functions:
- `startSession(projectPath, role)` — spawns Claude for the given role
- `stopSession(projectPath, role)` — sends stop command, monitors, force-kills
- `getSessionStatus(projectPath)` — returns running/stopped for each role
- `findRunningProcesses()` — scans for existing claude processes (for reconnection after restart)

In-memory PID map: `Map<string, { cto?: number, tester?: number, documenter?: number }>`

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

### Task 7: SSE stream utilities

**Files:**
- Create: `src/lib/stream-utils.ts`

- [ ] **Step 1: Implement**
Functions:
- `tailJsonl(filePath, onLine)` — watches a .jsonl file and calls onLine for each new line (fs.watch + read from last position)
- `createSSEStream(filePath)` — returns a ReadableStream that tails the jsonl file and formats as SSE events

- [ ] **Step 2: Commit**

---

## Phase 2: API Routes

### Task 8: Projects API

**Files:**
- Create: `src/app/api/projects/route.ts` — GET list, POST add
- Create: `src/app/api/projects/[id]/route.ts` — GET detail

- [ ] **Step 1: GET /api/projects** — returns project list from config
- [ ] **Step 2: POST /api/projects** — adds project path to config
- [ ] **Step 3: GET /api/projects/[id]** — returns full project detail (state, backlog summary, inbox summary, changelog)
- [ ] **Step 4: Commit**

### Task 9: Session management API

**Files:**
- Create: `src/app/api/projects/[id]/start/route.ts`
- Create: `src/app/api/projects/[id]/stop/route.ts`
- Create: `src/app/api/projects/[id]/pause/route.ts`
- Create: `src/app/api/projects/[id]/sessions/route.ts`
- Create: `src/app/api/projects/[id]/init/route.ts`

- [ ] **Step 1: POST start** — calls session manager to start CTO loop
- [ ] **Step 2: POST stop** — sends /redeye:stop via claude-runner, then monitors process
- [ ] **Step 3: POST pause** — sends /redeye:pause via claude-runner
- [ ] **Step 4: GET sessions** — returns session status for project
- [ ] **Step 5: POST init** — sends /redeye:init via claude-runner with wizard answers from request body
- [ ] **Step 6: Commit**

### Task 10: Write command APIs

**Files:**
- Create: `src/app/api/projects/[id]/backlog/route.ts`
- Create: `src/app/api/projects/[id]/steer/route.ts`
- Create: `src/app/api/projects/[id]/answer/route.ts`

- [ ] **Step 1: POST backlog** — sends /redeye:backlog via claude-runner
- [ ] **Step 2: POST steer** — sends /redeye:steer via claude-runner
- [ ] **Step 3: POST answer** — sends /redeye:status with answer via claude-runner
- [ ] **Step 4: Commit**

### Task 11: SSE stream API

**Files:**
- Create: `src/app/api/projects/[id]/stream/route.ts`

- [ ] **Step 1: GET stream** — returns SSE stream tailing session-cto.jsonl
- [ ] **Step 2: Commit**

---

## Phase 3: UI — Home Page

### Task 12: Design home page mockup

- [ ] **Step 1: Use designer subagent** to create an HTML mockup of the home page (global mission control). Card per project with: name, current task, health, pending questions, running/stopped status. Dark theme, red accent. "Add Project" button.

- [ ] **Step 2: Review and approve mockup**

### Task 13: Implement home page

**Files:**
- Create: `src/components/project-card.tsx`
- Create: `src/components/add-project-dialog.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx` (add header)

- [ ] **Step 1: Implement project-card** — displays project summary, click to navigate
- [ ] **Step 2: Implement add-project-dialog** — Radix dialog, path input, submit
- [ ] **Step 3: Implement home page** — fetches /api/projects, renders grid of project-cards, add button
- [ ] **Step 4: Add auto-refresh** (poll every 10 seconds)
- [ ] **Step 5: Test in browser**
- [ ] **Step 6: Commit**

---

## Phase 4: UI — Project Mission Control

### Task 14: Design project mission control mockup

- [ ] **Step 1: Use designer subagent** to create an HTML mockup of the project mission control page. Card grid layout matching the approved brainstorming mockup (option B). Cards: Working On, Health, Questions (red border when pending), Up Next, Recently Shipped, Controls.

- [ ] **Step 2: Review and approve**

### Task 15: Implement mission control cards

**Files:**
- Create: `src/components/mission-control/working-on-card.tsx`
- Create: `src/components/mission-control/health-card.tsx`
- Create: `src/components/mission-control/questions-card.tsx`
- Create: `src/components/mission-control/up-next-card.tsx`
- Create: `src/components/mission-control/shipped-card.tsx`
- Create: `src/components/mission-control/controls-card.tsx`
- Create: `src/components/phase-badge.tsx`

- [ ] **Step 1: Implement phase-badge** — human-readable phase names, colored dots
- [ ] **Step 2: Implement working-on-card** — shows current task title + phase + time
- [ ] **Step 3: Implement health-card** — green/yellow/red indicator + stats
- [ ] **Step 4: Implement questions-card** — red border when pending, answer buttons
- [ ] **Step 5: Implement up-next-card** — next 2-3 backlog items
- [ ] **Step 6: Implement shipped-card** — recent completed items
- [ ] **Step 7: Implement controls-card** — start/stop/pause buttons + steer/backlog buttons
- [ ] **Step 8: Commit**

### Task 16: Implement project page

**Files:**
- Create: `src/app/project/[id]/page.tsx`
- Create: `src/app/project/[id]/layout.tsx`

- [ ] **Step 1: Project layout** — project name header, nav links to sub-pages
- [ ] **Step 2: Project page** — fetches /api/projects/[id], renders card grid
- [ ] **Step 3: Add auto-refresh** (poll every 5 seconds)
- [ ] **Step 4: Test with real project (haze)**
- [ ] **Step 5: Commit**

---

## Phase 5: UI — Dialogs and Modals

### Task 17: Answer modal

**Files:**
- Create: `src/components/answer-modal.tsx`

- [ ] **Step 1: Implement** — shows question, context, default, suggested answers as buttons, free-text input, submit
- [ ] **Step 2: Wire to POST /api/projects/[id]/answer**
- [ ] **Step 3: Commit**

### Task 18: Add backlog dialog

**Files:**
- Create: `src/components/add-backlog-dialog.tsx`

- [ ] **Step 1: Implement** — quick-add text field, expandable for description + priority
- [ ] **Step 2: Wire to POST /api/projects/[id]/backlog**
- [ ] **Step 3: Commit**

### Task 19: Steer dialog

**Files:**
- Create: `src/components/steer-dialog.tsx`

- [ ] **Step 1: Implement** — text input for directive, submit
- [ ] **Step 2: Wire to POST /api/projects/[id]/steer**
- [ ] **Step 3: Commit**

---

## Phase 6: UI — Secondary Pages

### Task 20: Full backlog page

**Files:**
- Create: `src/app/project/[id]/backlog/page.tsx`

- [ ] **Step 1: Implement** — full backlog with sections (CEO Requests, Discovered, Triaged), status badges, quick-add
- [ ] **Step 2: Commit**

### Task 21: History page

**Files:**
- Create: `src/app/project/[id]/history/page.tsx`

- [ ] **Step 1: Implement** — parse changelog, render as timeline
- [ ] **Step 2: Commit**

### Task 22: Live transcript page

**Files:**
- Create: `src/app/project/[id]/live/page.tsx`
- Create: `src/components/transcript-viewer.tsx`

- [ ] **Step 1: Implement transcript-viewer** — renders JSON stream events as cards (text, tool calls, thinking)
- [ ] **Step 2: Implement live page** — connects to SSE stream, auto-scrolls
- [ ] **Step 3: Commit**

---

## Phase 7: Onboarding Wizard

### Task 23: Onboarding wizard

**Files:**
- Create: `src/components/onboarding-wizard.tsx`
- Modify: `src/components/add-project-dialog.tsx` — trigger wizard if not initialized

- [ ] **Step 1: Implement multi-step wizard** — Welcome → Vision → Tasks → Commands → Review → Initialize
- [ ] **Step 2: Wire to POST /api/projects/[id]/init**
- [ ] **Step 3: Show progress during initialization**
- [ ] **Step 4: Redirect to project mission control on completion**
- [ ] **Step 5: Commit**

---

## Phase 8: Integration Testing

### Task 24: End-to-end test with real project

- [ ] **Step 1: Start Control Tower** (`npm run dev`)
- [ ] **Step 2: Add the haze project via the UI**
- [ ] **Step 3: Verify project mission control shows correct data**
- [ ] **Step 4: Start RedEye via the Start button**
- [ ] **Step 5: Verify live transcript streams**
- [ ] **Step 6: Add a backlog item via the UI**
- [ ] **Step 7: Add a steering directive via the UI**
- [ ] **Step 8: Stop RedEye via the Stop button**
- [ ] **Step 9: Fix any issues found**
- [ ] **Step 10: Commit**

### Task 25: Polish and ship

- [ ] **Step 1: Review all pages for UI consistency**
- [ ] **Step 2: Add loading states and error boundaries**
- [ ] **Step 3: Add empty states (no projects, no backlog items, etc.)**
- [ ] **Step 4: Test on different viewport sizes**
- [ ] **Step 5: Final commit**
- [ ] **Step 6: Create GitHub repo Bitmia-ai/control-tower**
- [ ] **Step 7: Push**

---

## Build Order Summary

| Phase | Tasks | What's working after |
|-------|-------|---------------------|
| 1 | 1-7 | Core library: types, file readers, parsers, claude runner, session manager |
| 2 | 8-11 | Full API: projects, sessions, commands, streaming |
| 3 | 12-13 | Home page with project cards |
| 4 | 14-16 | Project mission control with all cards |
| 5 | 17-19 | Answer modal, backlog dialog, steer dialog |
| 6 | 20-22 | Backlog, history, live transcript pages |
| 7 | 23 | Onboarding wizard |
| 8 | 24-25 | Integration testing + polish |
