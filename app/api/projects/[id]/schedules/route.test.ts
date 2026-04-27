import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

// Mock fs/promises so we can control file reads + capture writes
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Stub commit+push so the POST handler doesn't shell out during tests.
vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true, pushed: true })),
}));

import {
  GET,
  POST,
  nextSchedIdFromContent,
  buildScheduleBlock,
} from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { commitAndPush } from "@/lib/git-commit-push";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;
const mockCommitAndPush = commitAndPush as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/schedules`);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

function makePost(
  id: string,
  body: unknown
): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(
    `http://localhost:3200/api/projects/${id}/schedules`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const params = Promise.resolve({ id });
  return [req, { params }];
}

const SAMPLE_MD = `# Scheduled Tasks

### SCHED-001: Weekly security audit
- **Frequency:** every 7d
- **Last run:** 2026-04-18T10:00:00Z
- **Task:**
  1. Review recent commits
  2. Check for outdated deps
- **Assigned to:** Security Reviewer
`;

describe("GET /api/projects/[id]/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 200 with empty schedules when schedules.md is absent (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ schedules: [] });
  });

  it("returns 200 with empty schedules when file has no SCHED- blocks", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockResolvedValue("# Scheduled Tasks\n\n_(No tasks yet.)_\n");
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedules).toEqual([]);
  });

  it("returns 200 with parsed schedules on happy path", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedules).toHaveLength(1);
    const s = json.data.schedules[0];
    expect(s.id).toBe("SCHED-001");
    expect(s.title).toBe("Weekly security audit");
    expect(s.frequency).toBe("every 7d");
    expect(s.lastRunIso).toBe("2026-04-18T10:00:00Z");
    expect(s.steps).toHaveLength(2);
    expect(s.assignedTo).toBe("Security Reviewer");
  });

  it("returns 500 when readFile throws a non-ENOENT error", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockRejectedValue(new Error("permission denied"));
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("reads schedules.md from the project .redeye directory", async () => {
    const projectPath = "/tmp/myproject";
    mockGetProject.mockResolvedValue({ name: "p", path: projectPath });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeRequest("1");
    await GET(req, ctx);
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining(".redeye/schedules.md"),
      "utf-8"
    );
  });
});

describe("nextSchedIdFromContent", () => {
  it("returns 1 for empty content", () => {
    expect(nextSchedIdFromContent("")).toBe(1);
  });

  it("returns 1 when there are no SCHED entries", () => {
    expect(nextSchedIdFromContent("# Scheduled Tasks\n\nNothing here\n")).toBe(1);
  });

  it("returns max+1 when SCHED entries exist", () => {
    const md = `### SCHED-1: a\n### SCHED-3: b\n### SCHED-2: c\n`;
    expect(nextSchedIdFromContent(md)).toBe(4);
  });

  it("ignores zero-padded vs unpadded distinction (compares numerically)", () => {
    const md = `### SCHED-001: a\n### SCHED-7: b\n`;
    expect(nextSchedIdFromContent(md)).toBe(8);
  });
});

describe("buildScheduleBlock", () => {
  it("formats a block matching the parser's expectations", () => {
    const block = buildScheduleBlock({
      id: "SCHED-2",
      name: "Daily standup digest",
      frequency: "every 1d",
      steps: ["Read transcripts", "Summarize", "Post to inbox"],
    });
    expect(block).toContain("### SCHED-2: Daily standup digest");
    expect(block).toContain("- **Frequency:** every 1d");
    // New schedules use "—" so the parser treats them as never-run (not epoch overdue)
    expect(block).toContain("- **Last run:** —");
    expect(block).toContain("- **Task:**");
    expect(block).toContain("  1. Read transcripts");
    expect(block).toContain("  2. Summarize");
    expect(block).toContain("  3. Post to inbox");
    expect(block).toContain("- **Assigned to:** CTO");
  });

  it("uses the provided assignedTo when given", () => {
    const block = buildScheduleBlock({
      id: "SCHED-9",
      name: "X",
      frequency: "every 1h",
      steps: ["s"],
      assignedTo: "Reviewer",
    });
    expect(block).toContain("- **Assigned to:** Reviewer");
  });
});

describe("POST /api/projects/[id]/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommitAndPush.mockResolvedValue({ committed: true, pushed: true });
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makePost("99", {
      name: "x",
      frequency: "every 1d",
      steps: ["a"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when name is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", {
      frequency: "every 1d",
      steps: ["a"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/name/i);
  });

  it("returns 400 when name is empty after sanitization", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", {
      name: "   ",
      frequency: "every 1d",
      steps: ["a"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when frequency is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", { name: "x", steps: ["a"] });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/frequency/i);
  });

  it("returns 400 when steps is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", { name: "x", frequency: "every 1d" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/steps/i);
  });

  it("returns 400 when steps is not an array", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", {
      name: "x",
      frequency: "every 1d",
      steps: "a",
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when steps is an empty array", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", {
      name: "x",
      frequency: "every 1d",
      steps: [],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when all steps are blank after sanitization", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const [req, ctx] = makePost("0", {
      name: "x",
      frequency: "every 1d",
      steps: ["   ", "\t", ""],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("creates SCHED-1 when schedules.md is absent (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "Daily digest",
      frequency: "every 1d",
      steps: ["read", "post"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(json.data.schedule.id).toBe("SCHED-1");
    expect(json.data.schedule.title).toBe("Daily digest");
    expect(json.data.schedule.frequency).toBe("every 1d");
    expect(json.data.schedule.steps).toEqual(["read", "post"]);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).toContain("### SCHED-1: Daily digest");
    expect(written).toContain("- **Frequency:** every 1d");
    // New schedules use "—" (never-run marker) not epoch date
    expect(written).toContain("- **Last run:** —");
    expect(written).toContain("  1. read");
    expect(written).toContain("  2. post");
    expect(written).toContain("- **Assigned to:** CTO");
  });

  it("assigns SCHED-(max+1) when schedules.md has existing entries", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockResolvedValue(
      `# Scheduled Tasks\n\n### SCHED-1: a\n- **Frequency:** every 1d\n- **Last run:** 1970-01-01T00:00:00Z\n- **Task:**\n  1. x\n- **Assigned to:** CTO\n\n### SCHED-7: b\n- **Frequency:** every 1d\n- **Last run:** 1970-01-01T00:00:00Z\n- **Task:**\n  1. y\n- **Assigned to:** CTO\n`
    );
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "New task",
      frequency: "every 1h",
      steps: ["step one"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedule.id).toBe("SCHED-8");
  });

  it("preserves prior file content and appends the new block", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const original =
      "# Scheduled Tasks\n\n### SCHED-1: existing\n- **Frequency:** every 1d\n- **Last run:** 1970-01-01T00:00:00Z\n- **Task:**\n  1. step\n- **Assigned to:** CTO\n";
    mockReadFile.mockResolvedValue(original);
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "New",
      frequency: "every 1d",
      steps: ["a"],
    });
    await POST(req, ctx);
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written.startsWith(original)).toBe(true);
    expect(written).toContain("### SCHED-2: New");
  });

  it("filters non-string and blank step entries before writing", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "Mixed steps",
      frequency: "every 1d",
      steps: ["one", "", null, "two", 7, "  three  "],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedule.steps).toEqual(["one", "two", "three"]);
  });

  it("strips newlines from name to defeat markdown injection", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "Hi\n### EVIL\n- **Frequency:** evil",
      frequency: "every 1d",
      steps: ["a"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const written = mockWriteFile.mock.calls[0][1] as string;
    // Sanitizer collapses \n to spaces; the malicious header is now part
    // of the title text, not a structural element.
    expect(written).not.toMatch(/\n### EVIL/);
  });

  it("calls commitAndPush with the schedules.md path", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    mockWriteFile.mockResolvedValue(undefined);

    const [req, ctx] = makePost("0", {
      name: "n",
      frequency: "every 1d",
      steps: ["a"],
    });
    await POST(req, ctx);
    expect(mockCommitAndPush).toHaveBeenCalledOnce();
    const args = mockCommitAndPush.mock.calls[0];
    expect(args[1]).toEqual([".redeye/schedules.md"]);
    expect(args[2]).toMatch(/SCHED-1/);
  });

  it("returns 415 when Content-Type is not application/json", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const req = new NextRequest(
      "http://localhost:3200/api/projects/0/schedules",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }
    );
    const res = await POST(req, { params: Promise.resolve({ id: "0" }) });
    expect(res.status).toBe(415);
  });
});
