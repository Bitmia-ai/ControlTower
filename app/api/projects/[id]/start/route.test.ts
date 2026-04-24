import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

const mockStartSession = vi.fn();
vi.mock("@/lib/session-manager", () => ({
  startSession: (...args: unknown[]) => mockStartSession(...args),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/start`, {
    method: "POST",
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe("POST /api/projects/[id]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it("returns 200 with sessionInfo on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const sessionInfo = { pid: 1234, role: "cto", startedAt: "2026-04-24T00:00:00Z" };
    mockStartSession.mockResolvedValue(sessionInfo);
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(sessionInfo);
    expect(mockStartSession).toHaveBeenCalledWith("/t", "cto");
  });

  it("returns 500 JSON when startSession throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockStartSession.mockRejectedValue(new Error("spawn failed"));
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("spawn failed");
  });
});
