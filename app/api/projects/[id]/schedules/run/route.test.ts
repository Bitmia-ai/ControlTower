import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/redeye-files", () => ({
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock("@/lib/task-id", () => ({
  getNextTaskId: vi.fn(),
}));

vi.mock("fs/promises", () => {
  const readFile = vi.fn();
  const writeFile = vi.fn();
  return {
    default: { readFile, writeFile },
    readFile,
    writeFile,
  };
});
// atomicWriteJson is what the route now calls; proxy to fs.writeFile so the
// existing assertions on mockWriteFile.mock.calls keep working.
vi.mock("@/lib/atomic-write", async () => {
  const fs = await import("fs/promises");
  const writeFile = fs.writeFile as unknown as (path: string, content: string) => Promise<void>;
  return {
    atomicWriteJson: (path: string, content: string) => writeFile(path, content),
  };
});

// Stub the git commit helper so tests don't shell out to git.
vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true })),
}));


import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { getNextTaskId } from "@/lib/task-id";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockGetStatus = getSessionStatus as ReturnType<typeof vi.fn>;
const mockStartSession = startSession as ReturnType<typeof vi.fn>;
const mockGetNextTaskId = getNextTaskId as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;

function makeRequest(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/schedules/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id }) }];
}

const SCHEDULES_MD = `# Scheduled Tasks

### SCHED-1: Weekly dependency audit
- **Frequency:** every 7 days
- **Last run:** 2026-04-20T10:00:00Z
- **Task:**
  1. npm audit
- **Assigned to:** CTO

### SCHED-2: Daily smoke
- **Frequency:** every 1 day
- **Last run:** (never)
- **Task:**
  1. ping
- **Assigned to:** CTO
`;

const TASKS_MD = `# Tasks

## CEO Requests

### T100: Some prior task
- **Type:** feature
- **Priority:** P1
- **Status:** done
`;

/**
 * Returns reader fn that responds with SCHEDULES_MD for schedules.md and
 * TASKS_MD for tasks.md (so the route can read both files).
 */
function makeReader(schedulesContent = SCHEDULES_MD, tasksContent: string | null = TASKS_MD) {
  return async (filePath: string) => {
    if (filePath.endsWith("schedules.md")) return schedulesContent;
    if (filePath.endsWith("tasks.md")) {
      if (tasksContent === null) {
        const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        throw enoent;
      }
      return tasksContent;
    }
    throw new Error(`unexpected read: ${filePath}`);
  };
}

describe("POST /api/projects/[id]/schedules/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue({ name: "test", path: "/tmp/proj" });
    mockReadFile.mockImplementation(makeReader());
    mockWriteFile.mockResolvedValue(undefined);
    mockGetStatus.mockReturnValue({ cto: { status: "running" }, tester: { status: "stopped" }, documenter: { status: "stopped" } });
    mockStartSession.mockResolvedValue({});
    mockGetNextTaskId.mockResolvedValue("T200");
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when scheduleId is missing", async () => {
    const [req, ctx] = makeRequest("1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/scheduleId/i);
  });

  it("returns 400 for invalid scheduleId format", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "../../etc/passwd" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/sched-/i);
  });

  it("returns 404 when schedules.md is missing", async () => {
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 404 when SCHED id does not exist in schedules.md", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-999" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/SCHED-999/);
  });

  it("rewrites Last run for the matching SCHED to a stale timestamp, leaves siblings intact, and never touches steering.md", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    // Now writes both schedules.md AND tasks.md
    const schedulesWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).endsWith("schedules.md")
    );
    expect(schedulesWrite).toBeDefined();
    const writtenPath: string = schedulesWrite![0] as string;
    const writtenContent: string = schedulesWrite![1] as string;
    expect(writtenPath).toContain("/.redeye/schedules.md");
    expect(writtenPath).not.toContain("steering.md");
    expect(writtenContent).toContain("### SCHED-1: Weekly dependency audit");
    expect(writtenContent).toContain("- **Last run:** 1970-01-01T00:00:00Z");
    // The original 2026-04-20 timestamp on SCHED-1 must be replaced.
    expect(writtenContent).not.toContain("2026-04-20T10:00:00Z");
    // Sibling SCHED-2 must be untouched.
    expect(writtenContent).toContain("### SCHED-2: Daily smoke");
    expect(writtenContent).toContain("- **Last run:** (never)");
    // Make sure no steering.md write happened.
    const steeringWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("steering.md")
    );
    expect(steeringWrite).toBeUndefined();
  });

  it("returns queued:true and scheduleId on success", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.queued).toBe(true);
    expect(json.data.scheduleId).toBe("SCHED-1");
  });

  it("does not call startSession when CTO is already running", async () => {
    mockGetStatus.mockReturnValue({ cto: { status: "running" }, tester: { status: "stopped" }, documenter: { status: "stopped" } });
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(mockStartSession).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.resumed).toBe(false);
  });

  it("calls startSession when CTO is stopped", async () => {
    mockGetStatus.mockReturnValue({ cto: { status: "stopped" }, tester: { status: "stopped" }, documenter: { status: "stopped" } });
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(mockStartSession).toHaveBeenCalledWith("/tmp/proj", "cto");
    const json = await res.json();
    expect(json.data.resumed).toBe(true);
  });

  it("is idempotent: a second run on an already-stale schedule is a no-op write but still returns 200", async () => {
    const [req1, ctx1] = makeRequest("1", { scheduleId: "SCHED-1" });
    await POST(req1, ctx1);
    const firstSchedulesWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).endsWith("schedules.md")
    );
    const firstWrite: string = firstSchedulesWrite![1] as string;
    // Re-read returns the already-stale content for schedules.md
    mockReadFile.mockImplementation(makeReader(firstWrite));
    const [req2, ctx2] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res2 = await POST(req2, ctx2);
    expect(res2.status).toBe(200);
    const secondSchedulesWrite = mockWriteFile.mock.calls
      .filter((c) => typeof c[0] === "string" && (c[0] as string).endsWith("schedules.md"))
      .at(-1);
    expect(secondSchedulesWrite![1]).toBe(firstWrite);
  });

  // ---------------------------------------------------------------------
  // T125: pending-task write behaviour
  // ---------------------------------------------------------------------

  it("writes a pending task to tasks.md with schedule title and SCHED id", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const tasksWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).endsWith("tasks.md")
    );
    expect(tasksWrite).toBeDefined();
    const writtenPath: string = tasksWrite![0] as string;
    const writtenContent: string = tasksWrite![1] as string;

    expect(writtenPath).toContain("/.redeye/tasks.md");
    expect(writtenContent).toContain("### T200: Run schedule: Weekly dependency audit");
    expect(writtenContent).toContain("- **Type:** scheduled");
    expect(writtenContent).toContain("- **Priority:** P1");
    expect(writtenContent).toContain("- **Status:** pending");
    expect(writtenContent).toContain("- **Schedule:** SCHED-1");
    // Inserted under CEO Requests, prior task preserved
    expect(writtenContent).toContain("## CEO Requests");
    expect(writtenContent).toContain("### T100: Some prior task");
  });

  it("includes taskId in response data", async () => {
    mockGetNextTaskId.mockResolvedValue("T201");
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    const json = await res.json();
    expect(json.data.taskId).toBe("T201");
    expect(json.data.queued).toBe(true);
    expect(json.data.scheduleId).toBe("SCHED-1");
  });

  it("falls back to scheduleId as title when block has no title", async () => {
    // Heading with no title text after the SCHED-id
    const noTitle = `# Scheduled Tasks

### SCHED-1
- **Frequency:** every 7 days
- **Last run:** 2026-04-20T10:00:00Z
- **Assigned to:** CTO
`;
    mockReadFile.mockImplementation(makeReader(noTitle));
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const tasksWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).endsWith("tasks.md")
    );
    expect(tasksWrite).toBeDefined();
    const writtenContent: string = tasksWrite![1] as string;
    // Falls back: title becomes the scheduleId itself
    expect(writtenContent).toContain("### T200: Run schedule: SCHED-1");
  });

  it("creates tasks.md with a CEO Requests header when missing", async () => {
    mockReadFile.mockImplementation(makeReader(SCHEDULES_MD, null));
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const tasksWrite = mockWriteFile.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).endsWith("tasks.md")
    );
    expect(tasksWrite).toBeDefined();
    const writtenContent: string = tasksWrite![1] as string;
    expect(writtenContent).toContain("## CEO Requests");
    expect(writtenContent).toContain("### T200: Run schedule: Weekly dependency audit");
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
