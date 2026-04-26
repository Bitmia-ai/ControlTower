import { describe, it, expect } from "vitest";
import {
  parseTasks,
  parseInbox,
  parseChangelog,
  parseSteering,
  parseSchedules,
  parseDurationMs,
  applyDirectiveEdit,
  applyDirectiveDelete,
} from "./redeye-parsers";

// ---------------------------------------------------------------------------
// parseTasks
// ---------------------------------------------------------------------------

describe("parseTasks", () => {
  it("returns empty array for empty content", () => {
    expect(parseTasks("")).toEqual([]);
  });

  it("returns empty array when no BL- items exist", () => {
    const content = `# Backlog\n\n## CEO Requests\n_(empty)_\n\n## Discovered\n\n## Triaged\n`;
    expect(parseTasks(content)).toEqual([]);
  });

  it("parses a single CEO request", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-001: Core CLI with colored output\n- **Type:** feature\n- **Priority:** critical\n- **Status:** pending\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "BL-001",
      title: "Core CLI with colored output",
      type: "feature",
      priority: "critical",
      status: "pending",
      section: "ceo",
    });
  });

  it("parses multiple items across sections", () => {
    const content = `# Backlog

## CEO Requests

### BL-001: First feature
- **Type:** feature
- **Priority:** P0 (must be done first, everything else depends on it)
- **Status:** complete

### BL-002: Second feature
- **Type:** refactor
- **Priority:** P0
- **Status:** done

## Discovered

## Triaged

### BL-007: Add unit tests
- **Type:** tech-debt
- **Priority:** P1 (medium)
- **Status:** planned
`;
    const items = parseTasks(content);
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({ id: "BL-001", section: "ceo", status: "done" });
    expect(items[1]).toMatchObject({ id: "BL-002", section: "ceo", status: "done" });
    expect(items[2]).toMatchObject({ id: "BL-007", section: "triaged", status: "planned" });
  });

  it("handles items with missing optional fields", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-005: Minimal item\n- **Status:** pending\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBeUndefined();
    expect(items[0].priority).toBeUndefined();
    expect(items[0].status).toBe("pending");
  });

  it("normalizes status values", () => {
    const content = `# Backlog

## CEO Requests

### BL-001: Done item
- **Status:** complete

### BL-002: In progress item
- **Status:** in-progress

### BL-003: Blocked item
- **Status:** blocked
`;
    const items = parseTasks(content);
    expect(items[0].status).toBe("done");
    expect(items[1].status).toBe("in-progress");
    expect(items[2].status).toBe("blocked");
  });

  it("defaults status to pending when field is missing", () => {
    const content = `# Backlog\n\n## Discovered\n\n### BL-003: No status field\n- **Type:** test\n`;
    const items = parseTasks(content);
    expect(items[0].status).toBe("pending");
  });

  it("deduplicates items with the same id across sections", () => {
    const content = `# Backlog

## CEO Requests

### BL-001: Original title
- **Status:** pending
- **Type:** feature

## Triaged

### BL-001: Updated title
- **Status:** planned
- **Type:** feature
`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("BL-001");
    expect(items[0].title).toBe("Updated title");
    expect(items[0].status).toBe("planned");
    expect(items[0].section).toBe("triaged");
  });

  it("parses Won't Do section", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n## Won't Do\n\n### BL-010: Rejected idea\n- **Status:** done\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0].section).toBe("wontdo");
  });

  // Regression: `wont-do` status was falling through normalizeStatus's default
  // case and being misclassified as `pending`, which made the dashboard count
  // wont-do items as remaining work and the loop never reached "exhausted".
  it("normalizes wont-do status (any spelling) to wontdo, not pending", () => {
    const content =
      `# Backlog\n\n## Triaged\n\n` +
      `### BL-001: hyphen form\n- **Status:** wont-do\n\n` +
      `### BL-002: smushed form\n- **Status:** wontdo\n\n` +
      `### BL-003: apostrophe form\n- **Status:** Won't Do\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.status)).toEqual(["wontdo", "wontdo", "wontdo"]);
  });

  // ---- Summary field (BL-026) ----

  it("parses Summary field on a done item", () => {
    const content = `# Backlog\n\n## Triaged\n\n### BL-048: Live tab collapsibles\n- **Type:** feature\n- **Status:** done\n- **Summary:** User message boxes are now collapsible by default to reduce noise.\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0].summary).toBe(
      "User message boxes are now collapsible by default to reduce noise."
    );
  });

  it("leaves summary undefined when field is missing", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-001: No summary\n- **Type:** feature\n- **Status:** pending\n`;
    const items = parseTasks(content);
    expect(items[0].summary).toBeUndefined();
  });

  it("preserves multi-word summary text verbatim", () => {
    const content = `# Backlog\n\n## Triaged\n\n### BL-040: Thinking events\n- **Status:** done\n- **Summary:** Added violet ThinkingCard with 80-char preview and red AssistantTextCard.\n`;
    const items = parseTasks(content);
    expect(items[0].summary).toBe(
      "Added violet ThinkingCard with 80-char preview and red AssistantTextCard."
    );
  });

  it("does not affect existing fields when Summary is present", () => {
    const content = `# Backlog\n\n## Triaged\n\n### BL-044: Add to Backlog button\n- **Type:** feature\n- **Priority:** P2\n- **Status:** done\n- **Summary:** Redesigned with PlusCircle icon and indigo accent.\n- **Spec:** docs/specs/BL-044.md\n`;
    const items = parseTasks(content);
    expect(items[0]).toMatchObject({
      id: "BL-044",
      type: "feature",
      priority: "P2",
      status: "done",
      summary: "Redesigned with PlusCircle icon and indigo accent.",
      spec: "docs/specs/BL-044.md",
    });
  });

  it("extracts the Reason field on wont-do items (BL-065)", () => {
    const content = `# Backlog\n\n## Won't Do\n\n### BL-099: Some rejected idea\n- **Type:** feature\n- **Priority:** P1\n- **Status:** wont-do\n- **Reason:** Superseded by BL-100 which covers the same requirement.\n`;
    const items = parseTasks(content);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "BL-099",
      status: "wontdo",
      section: "wontdo",
      reason: "Superseded by BL-100 which covers the same requirement.",
    });
  });

  it("returns reason: undefined when the field is absent (BL-065)", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-100: Active item\n- **Type:** feature\n- **Status:** pending\n`;
    const items = parseTasks(content);
    expect(items[0].reason).toBeUndefined();
  });

  it("does not coerce Reason from other fields (BL-065)", () => {
    const content = `# Backlog\n\n## Triaged\n\n### BL-101: Done with summary\n- **Type:** feature\n- **Status:** done\n- **Summary:** A summary text, not a reason.\n`;
    const items = parseTasks(content);
    expect(items[0].summary).toBe("A summary text, not a reason.");
    expect(items[0].reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseInbox
// ---------------------------------------------------------------------------

describe("parseInbox", () => {
  it("returns empty array for empty content", () => {
    expect(parseInbox("")).toEqual([]);
  });

  it("returns empty array when no Q- items exist", () => {
    const content = `# Inbox\n\n## Questions (Open)\n\n_(No questions yet.)_\n\n## Answered / Provided\n\n_(none)_\n`;
    expect(parseInbox(content)).toEqual([]);
  });

  it("parses a single open question", () => {
    const content = `# Inbox

## Questions (Open)

### Q-001: Should we use TypeScript?
- **Question:** Should we use TypeScript or JavaScript?
- **Default:** TypeScript
- **Options:** TypeScript, JavaScript

## Answered / Provided
`;
    const questions = parseInbox(content);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: "Q-001",
      question: "Should we use TypeScript or JavaScript?",
      default: "TypeScript",
      options: ["TypeScript", "JavaScript"],
      answered: false,
    });
  });

  it("parses answered questions", () => {
    const content = `# Inbox

## Questions (Open)

## Answered / Provided

### Q-002: Database choice
- **Question:** Which database should we use?
- **Default:** PostgreSQL
- **Answer:** PostgreSQL
`;
    const questions = parseInbox(content);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: "Q-002",
      answered: true,
      answer: "PostgreSQL",
    });
  });

  it("parses multiple questions from both sections", () => {
    const content = `# Inbox

## Questions (Open)

### Q-003: Auth strategy
- **Question:** OAuth or custom auth?
- **Default:** OAuth

### Q-004: Deploy target
- **Question:** Where to deploy?
- **Default:** Vercel

## Answered / Provided

### Q-001: Name
- **Question:** What is the project name?
- **Answer:** RedEye
`;
    const questions = parseInbox(content);
    expect(questions).toHaveLength(3);
    expect(questions.filter((q) => !q.answered)).toHaveLength(2);
    expect(questions.filter((q) => q.answered)).toHaveLength(1);
  });

  it("handles questions with missing optional fields", () => {
    const content = `# Inbox

## Questions (Open)

### Q-005:
- **Default:** yes
`;
    const questions = parseInbox(content);
    expect(questions).toHaveLength(1);
    expect(questions[0].options).toBeUndefined();
    expect(questions[0].context).toBeUndefined();
    expect(questions[0].answer).toBeUndefined();
  });

  it("parses context field", () => {
    const content = `# Inbox

## Questions (Open)

### Q-006: Feature flag
- **Question:** Enable dark mode by default?
- **Context:** Working on BL-004 UI polish
- **Default:** yes
`;
    const questions = parseInbox(content);
    expect(questions[0].context).toBe("Working on BL-004 UI polish");
  });
});

// ---------------------------------------------------------------------------
// parseChangelog
// ---------------------------------------------------------------------------

describe("parseChangelog", () => {
  it("returns empty array for empty content", () => {
    expect(parseChangelog("")).toEqual([]);
  });

  it("returns empty array when no iteration headers exist", () => {
    const content = `# Changelog\n\n_(Append-only iteration history.)_\n\n## Format\nEach entry follows: ...\n`;
    expect(parseChangelog(content)).toEqual([]);
  });

  it("parses a single iteration entry", () => {
    const content = `# Changelog

---

## Iteration 4 — 2026-04-23

- **Built:** BL-001 — Rename all ziggy-autopilot references to redeye
- **Review findings:** 0C 0M 1m — fixed
- **Deployed:** PASS
`;
    const entries = parseChangelog(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      title: "Rename all ziggy-autopilot references to redeye",
      date: "2026-04-23",
    });
    expect(entries[0].details).toContain("Built:");
  });

  it("parses multiple iteration entries", () => {
    const content = `# Changelog

---

## Iteration 16 — 2026-04-22

- **Built:** BL-005 — Verify pages
- **Deployed:** PASS

---

## Iteration 12 — 2026-04-22

- **Built:** BL-004 — Polish UI
- **Deployed:** PASS

---

## Iteration 9 — 2026-04-22

- **Built:** BL-003 — Remove PWA
- **Deployed:** PASS
`;
    const entries = parseChangelog(content);
    expect(entries).toHaveLength(3);
    expect(entries[0].title).toBe("Verify pages");
    expect(entries[1].title).toBe("Polish UI");
    expect(entries[2].title).toBe("Remove PWA");
  });

  it("handles iterations without a date", () => {
    const content = `# Changelog\n\n## Iteration 1\n\n- **Built:** BL-001\n`;
    const entries = parseChangelog(content);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBeUndefined();
    expect(entries[0].title).toBe("BL-001");
  });

  it("strips leading --- from entry details", () => {
    const content = `# Changelog\n\n---\n\n## Iteration 5 — 2026-01-01\n\n- **Built:** BL-005\n`;
    const entries = parseChangelog(content);
    expect(entries[0].details).not.toMatch(/^---/);
    expect(entries[0].details).toContain("Built:");
  });
});

// ---------------------------------------------------------------------------
// parseSteering
// ---------------------------------------------------------------------------

describe("parseSteering", () => {
  it("returns empty array for empty content", () => {
    expect(parseSteering("")).toEqual([]);
  });

  it("returns empty array when no ## Directives section", () => {
    const content = `# Steering\n\n> This file is for tactical directives.\n`;
    expect(parseSteering(content)).toEqual([]);
  });

  it("returns empty array when section has only placeholder text", () => {
    const content = `# Steering\n\n## Directives\n\n_(CEO adds directives here.)_\n`;
    expect(parseSteering(content)).toEqual([]);
  });

  it("parses a single directive", () => {
    const content = `# Steering\n\n## Directives\n\n- Do NOT touch files outside dashboard/\n`;
    const directives = parseSteering(content);
    expect(directives).toHaveLength(1);
    expect(directives[0].text).toBe("Do NOT touch files outside dashboard/");
  });

  it("parses multiple directives", () => {
    const content = `# Steering

## Directives

- Do NOT touch files outside dashboard/ — the plugin core is already done
- Do NOT merge to main — this is a feature branch
- Use red (#DC2626) as the accent color, replacing any amber/yellow
- Keep the Next.js 15 + React 19 + Tailwind CSS 4 stack — do not downgrade
`;
    const directives = parseSteering(content);
    expect(directives).toHaveLength(4);
    expect(directives[0].text).toContain("Do NOT touch files outside");
    expect(directives[3].text).toContain("Next.js 15");
  });

  it("skips non-list lines", () => {
    const content = `# Steering\n\n## Directives\n\nSome prose text here.\n\n- Valid directive\n`;
    const directives = parseSteering(content);
    expect(directives).toHaveLength(1);
    expect(directives[0].text).toBe("Valid directive");
  });
});

// ---------------------------------------------------------------------------
// applyDirectiveEdit / applyDirectiveDelete
// ---------------------------------------------------------------------------

describe("applyDirectiveEdit", () => {
  it("replaces the Nth directive while preserving surrounding lines", () => {
    const content = `# Steering\n\n## Directives\n\n- first\n- second\n- third\n`;
    const out = applyDirectiveEdit(content, 1, "second-edited");
    expect(out).toBe(`# Steering\n\n## Directives\n\n- first\n- second-edited\n- third\n`);
  });

  it("preserves ### subsection headers and blank lines", () => {
    const content =
      `# Steering\n\n## Directives\n\n### Group A\n\n- a1\n- a2\n\n### Group B\n\n- b1\n`;
    const out = applyDirectiveEdit(content, 1, "a2-edited");
    // Only the second bullet should change; subsection headers/blanks intact.
    expect(out).toBe(
      `# Steering\n\n## Directives\n\n### Group A\n\n- a1\n- a2-edited\n\n### Group B\n\n- b1\n`
    );
  });

  it("skips placeholder _( ) lines when counting", () => {
    const content =
      `# Steering\n\n## Directives\n\n- _(none yet)_\n- first\n- second\n`;
    // index 0 should map to "first", not the placeholder.
    const out = applyDirectiveEdit(content, 0, "first-edited");
    expect(out).toContain("- first-edited");
    expect(out).toContain("- _(none yet)_");
    expect(out).toContain("- second");
  });

  it("does not touch bullets in later sections", () => {
    const content =
      `# Steering\n\n## Directives\n\n- only directive\n\n## Other\n\n- not a directive\n`;
    const out = applyDirectiveEdit(content, 0, "edited");
    expect(out).toContain("- edited");
    expect(out).toContain("- not a directive");
  });

  it("preserves leading indentation of nested bullets", () => {
    const content =
      `# Steering\n\n## Directives\n\n  - indented directive\n`;
    const out = applyDirectiveEdit(content, 0, "edited");
    expect(out).toBe(`# Steering\n\n## Directives\n\n  - edited\n`);
  });

  it("throws RangeError when index is out of range", () => {
    const content = `# Steering\n\n## Directives\n\n- only\n`;
    expect(() => applyDirectiveEdit(content, 5, "x")).toThrow(RangeError);
    expect(() => applyDirectiveEdit(content, -1, "x")).toThrow(RangeError);
  });

  it("throws RangeError when there is no directives section", () => {
    expect(() => applyDirectiveEdit("# Steering\n", 0, "x")).toThrow(RangeError);
  });
});

describe("applyDirectiveDelete", () => {
  it("removes the Nth directive line entirely", () => {
    const content = `# Steering\n\n## Directives\n\n- first\n- second\n- third\n`;
    const out = applyDirectiveDelete(content, 1);
    expect(out).toBe(`# Steering\n\n## Directives\n\n- first\n- third\n`);
  });

  it("removes a directive without disturbing subsection headers", () => {
    const content =
      `# Steering\n\n## Directives\n\n### Group A\n\n- a1\n- a2\n\n### Group B\n\n- b1\n`;
    const out = applyDirectiveDelete(content, 0);
    expect(out).toBe(
      `# Steering\n\n## Directives\n\n### Group A\n\n- a2\n\n### Group B\n\n- b1\n`
    );
  });

  it("skips placeholder _( ) lines when counting", () => {
    const content =
      `# Steering\n\n## Directives\n\n- _(none yet)_\n- first\n- second\n`;
    const out = applyDirectiveDelete(content, 0);
    // "first" should be gone, placeholder kept.
    expect(out).toContain("- _(none yet)_");
    expect(out).not.toMatch(/^- first$/m);
    expect(out).toContain("- second");
  });

  it("does not touch bullets in later sections", () => {
    const content =
      `# Steering\n\n## Directives\n\n- only directive\n\n## Other\n\n- not a directive\n`;
    const out = applyDirectiveDelete(content, 0);
    expect(out).not.toContain("- only directive");
    expect(out).toContain("- not a directive");
  });

  it("throws RangeError when index is out of range", () => {
    const content = `# Steering\n\n## Directives\n\n- only\n`;
    expect(() => applyDirectiveDelete(content, 5)).toThrow(RangeError);
    expect(() => applyDirectiveDelete(content, -1)).toThrow(RangeError);
  });

  it("after parse → delete → parse, the array shrinks by one", () => {
    const content = `# Steering\n\n## Directives\n\n- a\n- b\n- c\n`;
    const before = parseSteering(content);
    const out = applyDirectiveDelete(content, 1);
    const after = parseSteering(out);
    expect(before.map((d) => d.text)).toEqual(["a", "b", "c"]);
    expect(after.map((d) => d.text)).toEqual(["a", "c"]);
  });
});

// ---------------------------------------------------------------------------
// parseDurationMs
// ---------------------------------------------------------------------------

describe("parseDurationMs", () => {
  it("parses hours", () => {
    expect(parseDurationMs("every 2h")).toBe(2 * 3600 * 1000);
  });

  it("parses days", () => {
    expect(parseDurationMs("every 7d")).toBe(7 * 86400 * 1000);
  });

  it("parses weeks", () => {
    expect(parseDurationMs("every 1w")).toBe(7 * 86400 * 1000);
  });

  it("returns null for unrecognised unit", () => {
    expect(parseDurationMs("every 30m")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDurationMs("")).toBeNull();
  });

  it("handles decimal values", () => {
    expect(parseDurationMs("every 1.5h")).toBe(1.5 * 3600 * 1000);
  });

  it("is case-insensitive for unit", () => {
    expect(parseDurationMs("every 3D")).toBe(3 * 86400 * 1000);
  });
});

// ---------------------------------------------------------------------------
// parseSchedules
// ---------------------------------------------------------------------------

const SAMPLE_SCHEDULES_MD = `# Scheduled Tasks

### SCHED-001: Weekly security audit
- **Frequency:** every 7d
- **Last run:** 2026-04-18T10:00:00Z
- **Task:**
  1. Review recent commits for potential security issues
  2. Check for outdated dependencies
- **Assigned to:** Security Reviewer

### SCHED-002: Hourly health check
- **Frequency:** every 1h
- **Last run:** 2026-04-25T06:00:00Z
- **Task:**
  1. Ping all services
- **Assigned to:** Ops
`;

describe("parseSchedules", () => {
  it("returns empty array for empty content", () => {
    expect(parseSchedules("")).toEqual([]);
  });

  it("returns empty array when no SCHED- blocks exist", () => {
    const content = "# Scheduled Tasks\n\n_(Define recurring tasks here.)_\n";
    expect(parseSchedules(content)).toEqual([]);
  });

  it("parses a single complete entry", () => {
    const nowMs = Date.parse("2026-04-26T10:00:00Z"); // 1 day + 1h after last run
    const entries = parseSchedules(SAMPLE_SCHEDULES_MD, nowMs);
    expect(entries).toHaveLength(2);

    const first = entries[0];
    expect(first.id).toBe("SCHED-001");
    expect(first.title).toBe("Weekly security audit");
    expect(first.frequency).toBe("every 7d");
    expect(first.lastRunIso).toBe("2026-04-18T10:00:00Z");
    expect(first.assignedTo).toBe("Security Reviewer");
    expect(first.steps).toHaveLength(2);
    expect(first.steps[0]).toBe("Review recent commits for potential security issues");
    expect(first.steps[1]).toBe("Check for outdated dependencies");
  });

  it("marks entry as overdue when past next due time", () => {
    // SCHED-001: last run 2026-04-18, every 7d -> next due 2026-04-25
    // nowMs is 2026-04-26 -> overdue
    const nowMs = Date.parse("2026-04-26T10:00:00Z");
    const entries = parseSchedules(SAMPLE_SCHEDULES_MD, nowMs);
    expect(entries[0].isOverdue).toBe(true);
  });

  it("marks entry as on-schedule when before next due time", () => {
    // SCHED-001: next due 2026-04-25T10:00:00Z
    // nowMs is 2026-04-24 -> not yet overdue
    const nowMs = Date.parse("2026-04-24T09:00:00Z");
    const entries = parseSchedules(SAMPLE_SCHEDULES_MD, nowMs);
    expect(entries[0].isOverdue).toBe(false);
  });

  it("sets isOverdue true and nextDueMs 0 when never run (no Last run field)", () => {
    const content = `### SCHED-003: Daily cleanup
- **Frequency:** every 1d
- **Task:**
  1. Clean temp files
- **Assigned to:** Dev
`;
    const nowMs = Date.now();
    const entries = parseSchedules(content, nowMs);
    expect(entries).toHaveLength(1);
    expect(entries[0].lastRunIso).toBeNull();
    expect(entries[0].isOverdue).toBe(true);
    expect(entries[0].nextDueMs).toBe(0);
  });

  it("sets nextDueMs null and isOverdue false when frequency not parseable", () => {
    const content = `### SCHED-004: Some task
- **Frequency:** every month
- **Last run:** 2026-04-01T00:00:00Z
- **Task:**
  1. Do something
- **Assigned to:** CTO
`;
    const nowMs = Date.now();
    const entries = parseSchedules(content, nowMs);
    expect(entries[0].nextDueMs).toBeNull();
    expect(entries[0].isOverdue).toBe(false);
  });

  it("correctly computes nextDueMs from lastRunIso + frequency", () => {
    const lastRun = "2026-04-18T10:00:00Z";
    const content = `### SCHED-005: Weekly check
- **Frequency:** every 7d
- **Last run:** ${lastRun}
- **Task:**
  1. Check stuff
- **Assigned to:** Dev
`;
    const entries = parseSchedules(content, Date.now());
    const expectedNextDue = Date.parse(lastRun) + 7 * 86400 * 1000;
    expect(entries[0].nextDueMs).toBe(expectedNextDue);
  });

  it("parses all three duration unit types", () => {
    const makeContent = (freq: string) =>
      `### SCHED-006: Test\n- **Frequency:** ${freq}\n- **Task:**\n  1. step\n- **Assigned to:** Dev\n`;

    const h = parseSchedules(makeContent("every 2h"));
    expect(h[0].nextDueMs).toBe(0); // never run -> 0

    const d = parseSchedules(makeContent("every 3d"));
    expect(d[0].nextDueMs).toBe(0);

    const w = parseSchedules(makeContent("every 2w"));
    expect(w[0].nextDueMs).toBe(0);
  });
});
