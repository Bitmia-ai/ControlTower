import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/cost-forecast", () => ({
  computeCostForecast: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { computeCostForecast } from "@/lib/cost-forecast";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockCompute = computeCostForecast as ReturnType<typeof vi.fn>;

function makeReq(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(
    `http://localhost:3200/api/projects/${id}/cost-forecast`
  );
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]/cost-forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the project is missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeReq("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
  });

  it("returns 400 when the id is not a non-negative integer", async () => {
    const [req, ctx] = makeReq("abc");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });

  it("returns 200 with the forecast data on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const fakeForecast = {
      sessions: [
        { file: "a.jsonl", cost: 1, mtimeMs: 1000 },
        { file: "b.jsonl", cost: 2, mtimeMs: 2000 },
      ],
      burnRatePerSession: 1.5,
      trend: "stable" as const,
      forecast24h: 4.5,
      forecast7d: 31.5,
      sessionsPerDay: 3,
      projectedSessions: [
        { sessionIndex: 2, cost: 1.5 },
        { sessionIndex: 3, cost: 1.5 },
        { sessionIndex: 4, cost: 1.5 },
        { sessionIndex: 5, cost: 1.5 },
        { sessionIndex: 6, cost: 1.5 },
      ],
    };
    mockCompute.mockResolvedValue(fakeForecast);
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(fakeForecast);
    expect(mockCompute).toHaveBeenCalledWith("/t");
  });

  it("returns 500 when computeCostForecast throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockCompute.mockRejectedValue(new Error("disk on fire"));
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk on fire");
  });

  it("uses the response envelope { data } for success and { error } for failure", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeReq("0");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(json).not.toHaveProperty("data");
  });
});
