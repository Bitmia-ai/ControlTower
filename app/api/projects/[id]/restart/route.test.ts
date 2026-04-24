import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("@/lib/session-manager", () => ({
  stopSession: vi.fn(),
  startSession: vi.fn(),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { stopSession, startSession } from "@/lib/session-manager";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockStopSession = stopSession as ReturnType<typeof vi.fn>;
const mockStartSession = startSession as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/restart`, { method: "POST" });
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("POST /api/projects/[id]/restart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 if id is not a number", async () => {
    const [req, ctx] = makeRequest("abc");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 200 with session info on success", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockStopSession.mockResolvedValue(undefined);
    mockStartSession.mockResolvedValue({ pid: 42, status: "running" });

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ pid: 42, status: "running" });
  });

  it("returns 500 JSON when startSession throws", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockStopSession.mockResolvedValue(undefined);
    mockStartSession.mockRejectedValue(new Error("session start failed"));

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("session start failed");
  });

  it("returns 500 JSON when stopSession throws", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockStopSession.mockRejectedValue(new Error("stop failed"));

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("stop failed");
  });

  it("returns 500 with string error when non-Error is thrown", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockStopSession.mockResolvedValue(undefined);
    mockStartSession.mockRejectedValue("raw string error");

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("raw string error");
  });
});
