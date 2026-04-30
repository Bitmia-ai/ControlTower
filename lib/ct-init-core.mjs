// lib/ct-init-core.mjs — Pure scaffolding functions for `npx control-tower init`.
// All file content generators are pure functions; runInit performs the writes
// using an injectable fs module so tests can mock fs/promises.
//
// No subprocess spawning, no shell exec, no network calls. All output is
// static string generation written to disk via fs.writeFile.

import fsDefault from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Content generators
// ---------------------------------------------------------------------------

/**
 * makeConfigMd — generates `.redeye/config.md`.
 *
 * @param {object} opts
 * @param {string} opts.projectName  Display name for the project.
 * @param {string} opts.cwd          Absolute path to the repo root.
 * @param {string} opts.redeyePluginPath  Path to the RedEye plugin install (default `~/redeye`).
 * @param {string} opts.timestamp    ISO 8601 string (caller passes new Date().toISOString()).
 * @returns {string}
 */
export function makeConfigMd(opts) {
  const {
    projectName,
    cwd,
    redeyePluginPath = "~/redeye",
    timestamp,
  } = opts;

  return `# ${projectName} — RedEye Configuration

> **CTO operating manual.** Essential config read every iteration. For role details and permissions, see \`.redeye/reference.md\`.

## Vision

_(Replace this with your product vision — what are we building, for whom, and why now?)_

## Project

- **Name:** ${projectName}
- **Repo:** ${cwd}
- **RedEye Plugin:** ${redeyePluginPath}
- **Started:** ${timestamp}
- **State file:** \`.redeye/state.json\`

## Roles

| Role | Model | When Spawned |
|------|-------|-------------|
| CTO (you) | sonnet | Every iteration (orchestrator) |
| VP Product | sonnet | PLAN, INCORPORATE |
| VP Engineering | sonnet (S-tier) / opus (M/L-tier) | PLAN |
| Dev (generic) | sonnet | BUILD |
| Dev (specialist) | opus | BUILD (when needed) |
| Ops/SRE | sonnet | DEPLOY, STABILIZE |
| QA Lead | sonnet | BUILD (writes E2E), DEPLOY (runs regression) |
| User Tester | sonnet | Background (after DEPLOY only) |
| Security Reviewer | sonnet (S-tier) / opus (M/L-tier) | REVIEW |
| Systems Reviewer | sonnet (S-tier) / opus (M/L-tier) | REVIEW |

## Commands

- **Deploy:** \`echo 'No deploy command configured'\`
- **Verify:** \`echo 'No verify command configured'\`
- **Test (unit/integration):** \`echo 'No test command configured'\`
- **Test (E2E):** \`echo 'No e2e command configured'\`
- **App URL:** \`http://localhost:3000\`

## Worktree Isolation

- **Enabled:** true

## Phase Machine

**Core cycle:** TRIAGE -> PLAN -> BUILD -> REVIEW -> DEPLOY -> VERIFY -> (back to TRIAGE)

**Side phases:** STABILIZE (broken env), HARDEN (empty backlog), SCHEDULES (overdue tasks), INCORPORATE (CEO answers)

**Hard limits:**
- Max review cycles: 3 (then escalate)
- Max stabilize attempts: 3 (then escalate)
- Max iterations per session: 100

## Engineering Culture

1. **TDD is mandatory.** Tests before or alongside implementation.
2. **Reviews are mandatory.** Every feature goes through REVIEW before DEPLOY.
3. **Use skills.** Agents MUST invoke the appropriate phase skill.
4. **Fail fast.** Fix failing tests before moving on.
5. **Incremental delivery.** Each feature cycle should be deployable.

## Git Safety

1. Never force push.
2. Never \`git add .\` or \`git add -A\`. Stage specific files.
3. No interactive rebase.
4. Conventional commits (\`feat:\`, \`fix:\`, \`chore:\`, \`docs:\`, \`test:\`).
5. One concern per commit.
6. Work on \`main\` unless CEO directs otherwise.
`;
}

/**
 * makeTasksMd — generates `.redeye/tasks.md`.
 *
 * @param {object} opts
 * @param {boolean} opts.addSampleTask  If true, includes a T001 placeholder task in CEO Requests.
 * @returns {string}
 */
export function makeTasksMd(opts = {}) {
  const { addSampleTask = false } = opts;

  const sample = addSampleTask
    ? `
### T001: Hello world — describe your first task here
- **Type:** feature
- **Priority:** P1
- **Status:** pending
- **Description:** Replace this with your first real task description.
`
    : "";

  return `# Backlog

## CEO Requests
${sample}
## Discovered

## Triaged

## Won't Do
`;
}

/**
 * makeStateJson — generates `.redeye/state.json` content (as JSON string).
 *
 * @param {object} opts
 * @param {boolean} opts.addSampleTask  Reserves T001 in counters when true.
 * @returns {string}
 */
export function makeStateJson(opts = {}) {
  const { addSampleTask = false } = opts;

  const state = {
    schema_version: 1,
    iteration: 0,
    started_at: null,
    phase: "triage",
    phase_status: "pending",
    task_id: null,
    task_title: null,
    spec_file: null,
    review_cycles: 0,
    max_review_cycles: 3,
    stabilize_attempts: 0,
    background_agents: {
      user_tester: { status: "not_started" },
      documenter: { status: "not_started" },
    },
    git_state: {
      last_commit: null,
      branch: "main",
      last_good_deploy_tag: null,
      merge_status: "clean",
      notes: null,
    },
    blocked_items: [],
    iteration_log: [],
    counters: {
      next_task_id: addSampleTask ? 2 : 1,
      next_q_id: 1,
      next_sched_id: 1,
      next_cred_id: 1,
    },
    cost_tracking: {
      iterations_this_session: 0,
      max_iterations_per_session: 100,
      last_ceo_alert_iteration: 0,
      full_regression_last_run: 0,
    },
    health: {
      confidence: "HIGH",
      env_status: "healthy",
      iterations_since_last_deploy: 0,
      questions_awaiting_ceo: 0,
      blocked_items_count: 0,
    },
    item_costs: {},
    item_cost_starts: {},
  };

  return JSON.stringify(state, null, 2) + "\n";
}

/**
 * makeSteeringMd — generates `.redeye/steering.md`.
 *
 * @returns {string}
 */
export function makeSteeringMd() {
  return `# Steering

> CEO directives the CTO reads at the start of every iteration. Add short imperative
> statements (one per line). Common directives: STOP, PAUSE, focus area, deadline,
> bug report, priority change.

## Directives

_(No directives yet. Use \`/redeye:steer\` to add one, or edit this file directly.)_
`;
}

/**
 * makeInboxMd — generates `.redeye/inbox.md`.
 *
 * @returns {string}
 */
export function makeInboxMd() {
  return `# Inbox

> Async questions the CTO has asked the CEO, plus pending answers. Each question
> has a deadline; if the CEO does not respond by then, the CTO proceeds with the
> default option.

## Questions

_(No open questions.)_

## Answered

_(No answered questions yet.)_
`;
}

/**
 * makeSchedulesMd — generates `.redeye/schedules.md`.
 *
 * @returns {string}
 */
export function makeSchedulesMd() {
  return `# Schedules

> Recurring tasks the CTO runs on a cadence (e.g. weekly security review,
> monthly dependency bump). Use \`/redeye:schedules\` to add or edit entries.

## Active

_(No scheduled tasks.)_
`;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * runInit — Writes the six `.redeye/` scaffold files into `opts.cwd`.
 *
 * @param {object} opts
 * @param {string} opts.projectName
 * @param {string} opts.cwd            Repo root where `.redeye/` will be created.
 * @param {string} [opts.redeyePluginPath]
 * @param {boolean} [opts.addSampleTask]
 * @param {boolean} [opts.force]       Overwrite an existing .redeye/ if true.
 * @param {string} [opts.timestamp]    Override timestamp (mainly for tests).
 * @param {object} [fsModule]          Injected fs/promises (defaults to real one).
 * @returns {Promise<{ written: string[] }>}
 */
export async function runInit(opts, fsModule) {
  const fs = fsModule || fsDefault;
  const {
    projectName,
    cwd,
    redeyePluginPath = "~/redeye",
    addSampleTask = false,
    timestamp = new Date().toISOString(),
  } = opts;

  if (!projectName) throw new Error("runInit: projectName is required");
  if (!cwd) throw new Error("runInit: cwd is required");

  const redeyeDir = path.join(cwd, ".redeye");
  await fs.mkdir(redeyeDir, { recursive: true });

  const files = [
    {
      name: "config.md",
      content: makeConfigMd({ projectName, cwd, redeyePluginPath, timestamp }),
    },
    { name: "tasks.md", content: makeTasksMd({ addSampleTask }) },
    { name: "state.json", content: makeStateJson({ addSampleTask }) },
    { name: "steering.md", content: makeSteeringMd() },
    { name: "inbox.md", content: makeInboxMd() },
    { name: "schedules.md", content: makeSchedulesMd() },
  ];

  const written = [];
  for (const file of files) {
    const fullPath = path.join(redeyeDir, file.name);
    await fs.writeFile(fullPath, file.content, "utf8");
    written.push(fullPath);
    // Progress line — silenced in tests because they capture / mock console.
    if (typeof opts.onWrite === "function") opts.onWrite(file.name);
  }

  return { written };
}
