import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

const mockStopSession = vi.fn();
vi.mock("@/lib/session-manager", () => ({
  stopSession: (...args: unknown[]) => mockStopSession(...args),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(
    `http://localhost:3200/api/projects/${id}/force-stop`,
    { method: "POST" }
  );
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("POST /api/projects/[id]/force-stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStopSession.mockResolvedValue(undefined);
  });

  it("returns 200 and calls stopSession with project path and cto role", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(mockStopSession).toHaveBeenCalledTimes(1);
    expect(mockStopSession).toHaveBeenCalledWith("/t", "cto");
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    expect(mockStopSession).not.toHaveBeenCalled();
  });

  it("returns 500 JSON when stopSession throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockStopSession.mockRejectedValue(new Error("kill failed"));
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("kill failed");
  });
});
