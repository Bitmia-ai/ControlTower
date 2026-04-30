import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/redeye-files", () => ({
  readTasks: vi.fn(),
}));

vi.mock("@/lib/velocity", () => ({
  computeVelocity: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { readTasks } from "@/lib/redeye-files";
import { computeVelocity } from "@/lib/velocity";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockReadTasks = readTasks as ReturnType<typeof vi.fn>;
const mockCompute = computeVelocity as ReturnType<typeof vi.fn>;

function makeReq(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(
    `http://localhost:3200/api/projects/${id}/velocity`
  );
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]/velocity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the id is not a non-negative integer", async () => {
    const [req, ctx] = makeReq("abc");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
    expect(mockGetProject).not.toHaveBeenCalled();
  });

  it("returns 404 when the project lookup returns null", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeReq("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
  });

  it("returns 200 with the computed velocity on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([]);
    const fakeResult = {
      weeks: [
        {
          weekStart: "2026-04-19",
          count: 2,
          rollingAvg: 1,
          isCurrentWeek: false,
        },
      ],
      avgTasksPerWeek: 2,
      trend: "stable" as const,
      totalCompletedWithDate: 2,
    };
    mockCompute.mockReturnValue(fakeResult);
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(fakeResult);
    expect(mockReadTasks).toHaveBeenCalledWith("/t");
    expect(mockCompute).toHaveBeenCalled();
  });

  it("returns 500 when readTasks throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockRejectedValue(new Error("disk on fire"));
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk on fire");
  });

  it("returns 500 when computeVelocity throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([]);
    mockCompute.mockImplementation(() => {
      throw new Error("bad math");
    });
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("bad math");
  });

  it("uses the response envelope { data } on success and { error } on failure", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(json).not.toHaveProperty("data");
  });
});
