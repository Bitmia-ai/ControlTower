import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockGetStatus = getSessionStatus as ReturnType<typeof vi.fn>;
const mockStartSession = startSession as ReturnType<typeof vi.fn>;
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

describe("POST /api/projects/[id]/schedules/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue({ name: "test", path: "/tmp/proj" });
    mockReadFile.mockResolvedValue(SCHEDULES_MD);
    mockWriteFile.mockResolvedValue(undefined);
    mockGetStatus.mockReturnValue({ cto: { status: "running" }, tester: { status: "stopped" }, documenter: { status: "stopped" } });
    mockStartSession.mockResolvedValue({});
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
    expect(mockWriteFile).toHaveBeenCalledOnce();
    const writtenPath: string = mockWriteFile.mock.calls[0][0];
    const writtenContent: string = mockWriteFile.mock.calls[0][1];
    expect(writtenPath).toContain("/.redeye/schedules.md");
    expect(writtenPath).not.toContain("steering.md");
    expect(writtenContent).toContain("### SCHED-1: Weekly dependency audit");
    expect(writtenContent).toContain("- **Last run:** 1970-01-01T00:00:00Z");
    // The original 2026-04-20 timestamp on SCHED-1 must be replaced.
    expect(writtenContent).not.toContain("2026-04-20T10:00:00Z");
    // Sibling SCHED-2 must be untouched.
    expect(writtenContent).toContain("### SCHED-2: Daily smoke");
    expect(writtenContent).toContain("- **Last run:** (never)");
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
    const firstWrite: string = mockWriteFile.mock.calls[0][1];
    // Re-read returns the already-stale content
    mockReadFile.mockResolvedValue(firstWrite);
    const [req2, ctx2] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res2 = await POST(req2, ctx2);
    expect(res2.status).toBe(200);
    const secondWrite: string = mockWriteFile.mock.calls[1][1];
    expect(secondWrite).toBe(firstWrite);
  });
});
