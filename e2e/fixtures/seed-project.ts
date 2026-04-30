// Seeds a project directory with a complete .redeye/ tree shaped like a
// real RedEye project. Used by e2e/global-setup.ts to make Playwright tests
// hermetic — no dependency on the user's local ~/.redeye/config.json or
// any of their actual project directories.

import fs from "node:fs";
import path from "node:path";

export interface SeedProjectOpts {
  /** Absolute path where the project root will be created. */
  rootDir: string;
  /** State.json fields. Optional fields default to an idle TRIAGE state. */
  state?: {
    iteration?: number;
    phase?: string;
    phase_status?: string;
    task_id?: string | null;
    task_title?: string | null;
  };
  /** Tasks to write into tasks.md. Each becomes a `### {id}: {title}` block. */
  tasks: Array<{
    id: string;
    title: string;
    status: "done" | "planned" | "pending" | "in-progress" | "blocked" | "wontdo" | "pending-triage";
    section?: "ceo" | "discovered" | "triaged" | "wontdo";
    type?: string;
    priority?: string;
    summary?: string;
    description?: string;
    cost_usd?: number;
    mergedAt?: string;
    mergedIteration?: number;
  }>;
  /** Optional schedules.md content (full markdown body). */
  schedulesMd?: string;
  /** Optional active steering directive (will be appended to a header). */
  steeringDirective?: string;
}

const DEFAULT_SCHEDULES = `# Scheduled Tasks

_(Define recurring tasks here. Minimum frequency: 1 hour.)_

### SCHED-1: Security Review
- **Frequency:** every 7d
- **Last run:** 2026-04-29T15:21:31Z
- **Task:**
  1. Run npm audit --omit=dev and capture findings
  2. Scan src/ for hardcoded API keys, tokens, or credentials
  3. Open a P0 task if anything is found, otherwise log "OK" to status.md
- **Assigned to:** cto

### SCHED-2: Simplify code
- **Frequency:** every 3h
- **Last run:** 2026-04-30T13:00:00Z
- **Task:**
  1. Look for low-hanging code-simplification opportunities
- **Assigned to:** cto

### SCHED-3: UX evaluation
- **Frequency:** every 1d
- **Last run:** 1970-01-01T00:00:00Z
- **Task:**
  1. Spot-check the dashboard UX
- **Assigned to:** cto
`;

function buildState(opts: SeedProjectOpts) {
  const state = opts.state ?? {};
  const iteration_log = Array.from({ length: 3 }).map((_, i) => ({
    iteration: 50 + i,
    phases: ["TRIAGE", "PLAN", "BUILD", "REVIEW", "DEPLOY", "VERIFY", "MERGE"],
    outcome: `Iteration ${50 + i} shipped a backlog item.`,
    next: "TRIAGE",
    timestamp: new Date(Date.UTC(2026, 3, 30 - i, 12, 0, 0)).toISOString(),
  }));
  return {
    schema_version: 1,
    iteration: state.iteration ?? 56,
    started_at: "2026-04-30T12:17:46Z",
    phase: state.phase ?? "TRIAGE",
    phase_status: state.phase_status ?? "complete",
    task_id: state.task_id ?? null,
    task_title: state.task_title ?? null,
    spec_file: null,
    worktree_path: null,
    worktree_branch: null,
    phase_progress: {},
    review_cycles: 0,
    max_review_cycles: 3,
    stabilize_attempts: 0,
    background_agents: {
      user_tester: { status: "idle", heartbeat: null, bugs_this_cycle: 0, persona_index: 0 },
      documenter: { status: "idle", heartbeat: null, working_on_iteration: null },
    },
    git_state: {
      last_commit: "merged-main",
      branch: "main",
      last_good_deploy_tag: "last-good-deploy",
    },
    blocked_items: [],
    iteration_log,
    health: {
      confidence: "HIGH",
      env_status: "healthy",
      iterations_since_last_deploy: 0,
      questions_awaiting_ceo: 0,
      blocked_items_count: 0,
    },
    counters: { next_task_id: 100, next_q_id: 1 },
    item_costs: Object.fromEntries(
      opts.tasks
        .filter((t) => t.cost_usd !== undefined)
        .map((t) => [t.id, t.cost_usd])
    ),
  };
}

function buildTasksMd(opts: SeedProjectOpts): string {
  const lines: string[] = ["# Tasks", ""];

  // Group tasks by section. Tests don't really care about section
  // boundaries beyond "done items appear in the Done section" — but the
  // parser splits on these `## ` headers, so we have to emit them.
  const sections: Record<string, typeof opts.tasks> = {
    ceo: [],
    discovered: [],
    triaged: [],
    wontdo: [],
  };
  for (const t of opts.tasks) {
    const sec = t.section ?? (t.status === "wontdo" ? "wontdo" : "ceo");
    sections[sec].push(t);
  }

  const headers: Record<string, string> = {
    ceo: "## CEO Requests",
    discovered: "## Discovered",
    triaged: "## Triaged / Planned",
    wontdo: "## Won't Do",
  };

  for (const [secKey, header] of Object.entries(headers)) {
    const items = sections[secKey];
    if (items.length === 0) continue;
    lines.push(header, "");
    for (const t of items) {
      lines.push(`### ${t.id}: ${t.title}`);
      lines.push(`- **Type:** ${t.type ?? "feature"}`);
      lines.push(`- **Priority:** ${t.priority ?? "P1"}`);
      lines.push(`- **Status:** ${t.status}`);
      if (t.summary) lines.push(`- **Summary:** ${t.summary}`);
      if (t.description) lines.push(`- **Description:** ${t.description}`);
      if (t.cost_usd !== undefined) lines.push(`- **Cost:** $${t.cost_usd.toFixed(2)}`);
      if (t.mergedAt || t.mergedIteration) {
        const mIter = t.mergedIteration ?? 50;
        const mDate = t.mergedAt ?? "2026-04-30";
        lines.push(`- **Merged:** ${mDate} (iter ${mIter})`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

const STATUS_MD = `# RedEye Status — Iteration 56 TRIAGE Complete

**Date:** 2026-04-30T14:35:00Z

## Triage Summary

- **Tester reports:** None
- **Inbox:** No open questions
- **CEO Requests:** No pending items
- **Discovered:** Empty
- **Schedules:** None overdue
- **Environment:** Healthy
- **Active claims:** None

## Decision

**Next phase: IDLE**

All task queues are empty.
`;

const CHANGELOG_MD = `# Changelog

## Iteration 55 — 2026-04-30
- Shipped T044 (--condition flag in --help).
- Shipped T045 (post-merge dist rebuild).

## Iteration 54 — 2026-04-29
- Shipped T043 (weather condition filter).
`;

const FEEDBACK_MD = `# Feedback

_(empty)_
`;

const REFERENCE_MD = `# Reference

Project conventions captured here for the agent.
`;

const INBOX_MD = `# Inbox

_(no open questions)_
`;

const TESTER_REPORTS_MD = `# Tester Reports

_(no reports yet)_
`;

const STEERING_HEADER = `# Steering Directives

_(Active directives are listed below. They are appended to the agent's
context every iteration.)_

`;

export function seedProject(opts: SeedProjectOpts): void {
  const redeyeDir = path.join(opts.rootDir, ".redeye");
  fs.mkdirSync(redeyeDir, { recursive: true });

  fs.writeFileSync(
    path.join(redeyeDir, "state.json"),
    JSON.stringify(buildState(opts), null, 2)
  );
  fs.writeFileSync(path.join(redeyeDir, "tasks.md"), buildTasksMd(opts));
  fs.writeFileSync(path.join(redeyeDir, "status.md"), STATUS_MD);
  fs.writeFileSync(path.join(redeyeDir, "changelog.md"), CHANGELOG_MD);
  fs.writeFileSync(path.join(redeyeDir, "schedules.md"), opts.schedulesMd ?? DEFAULT_SCHEDULES);
  fs.writeFileSync(path.join(redeyeDir, "feedback.md"), FEEDBACK_MD);
  fs.writeFileSync(path.join(redeyeDir, "reference.md"), REFERENCE_MD);
  fs.writeFileSync(path.join(redeyeDir, "inbox.md"), INBOX_MD);
  fs.writeFileSync(path.join(redeyeDir, "tester-reports.md"), TESTER_REPORTS_MD);
  fs.writeFileSync(
    path.join(redeyeDir, "steering.md"),
    STEERING_HEADER + (opts.steeringDirective ?? "")
  );
}
