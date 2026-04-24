import { describe, it, expect } from "vitest";
import {
  parseBacklog,
  parseInbox,
  parseChangelog,
  parseSteering,
} from "./redeye-parsers";

// ---------------------------------------------------------------------------
// parseBacklog
// ---------------------------------------------------------------------------

describe("parseBacklog", () => {
  it("returns empty array for empty content", () => {
    expect(parseBacklog("")).toEqual([]);
  });

  it("returns empty array when no BL- items exist", () => {
    const content = `# Backlog\n\n## CEO Requests\n_(empty)_\n\n## Discovered\n\n## Triaged\n`;
    expect(parseBacklog(content)).toEqual([]);
  });

  it("parses a single CEO request", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-001: Core CLI with colored output\n- **Type:** feature\n- **Priority:** critical\n- **Status:** pending\n`;
    const items = parseBacklog(content);
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
    const items = parseBacklog(content);
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({ id: "BL-001", section: "ceo", status: "done" });
    expect(items[1]).toMatchObject({ id: "BL-002", section: "ceo", status: "done" });
    expect(items[2]).toMatchObject({ id: "BL-007", section: "triaged", status: "planned" });
  });

  it("handles items with missing optional fields", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n### BL-005: Minimal item\n- **Status:** pending\n`;
    const items = parseBacklog(content);
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
    const items = parseBacklog(content);
    expect(items[0].status).toBe("done");
    expect(items[1].status).toBe("in-progress");
    expect(items[2].status).toBe("blocked");
  });

  it("defaults status to pending when field is missing", () => {
    const content = `# Backlog\n\n## Discovered\n\n### BL-003: No status field\n- **Type:** test\n`;
    const items = parseBacklog(content);
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
    const items = parseBacklog(content);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("BL-001");
    expect(items[0].title).toBe("Updated title");
    expect(items[0].status).toBe("planned");
    expect(items[0].section).toBe("triaged");
  });

  it("parses Won't Do section", () => {
    const content = `# Backlog\n\n## CEO Requests\n\n## Won't Do\n\n### BL-010: Rejected idea\n- **Status:** done\n`;
    const items = parseBacklog(content);
    expect(items).toHaveLength(1);
    expect(items[0].section).toBe("wontdo");
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
