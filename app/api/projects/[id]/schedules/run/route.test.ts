import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
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

const STEERING_MD = `# Steering\n\n## Directives\n\n- existing directive\n`;

describe("POST /api/projects/[id]/schedules/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue({ name: "test", path: "/tmp/proj" });
    mockReadFile.mockResolvedValue(STEERING_MD);
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
    expect(json.error).toMatch(/invalid/i);
  });

  it("writes RUN_SCHEDULE directive to steering.md", async () => {
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalledOnce();
    const written: string = mockWriteFile.mock.calls[0][1];
    expect(written).toContain("RUN_SCHEDULE: SCHED-1");
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
    await POST(req, ctx);
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it("calls startSession when CTO is stopped", async () => {
    mockGetStatus.mockReturnValue({ cto: { status: "stopped" }, tester: { status: "stopped" }, documenter: { status: "stopped" } });
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    await POST(req, ctx);
    expect(mockStartSession).toHaveBeenCalledWith("/tmp/proj", "cto");
  });

  it("creates steering.md with directive when file does not exist", async () => {
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);
    const [req, ctx] = makeRequest("1", { scheduleId: "SCHED-1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const written: string = mockWriteFile.mock.calls[0][1];
    expect(written).toContain("RUN_SCHEDULE: SCHED-1");
  });
});
