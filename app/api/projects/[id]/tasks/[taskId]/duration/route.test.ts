import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

const mockReadState = vi.fn();
vi.mock("@/lib/redeye-files", () => ({
  readState: (...args: unknown[]) => mockReadState(...args),
}));

const mockCompute = vi.fn();
vi.mock("@/lib/task-duration", () => ({
  computeTaskDuration: (...args: unknown[]) => mockCompute(...args),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeCtx(id: string, taskId: string) {
  return { params: Promise.resolve({ id, taskId }) };
}

function makeReq(id: string, taskId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3200/api/projects/${id}/tasks/${taskId}/duration`,
    { method: "GET" }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects/[id]/tasks/[taskId]/duration", () => {
  it("returns 400 when taskId does not match T<number>", async () => {
    const res = await GET(makeReq("0", "INVALID"), makeCtx("0", "INVALID"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("taskId must match T<number>");
  });

  it("returns 400 when project id is not a non-negative integer", async () => {
    const res = await GET(makeReq("abc", "T119"), makeCtx("abc", "T119"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });

  it("returns 404 when project is not registered", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await GET(makeReq("99", "T119"), makeCtx("99", "T119"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
  });

  it("returns 200 with TaskDurationResult on happy path", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockReadState.mockResolvedValue({
      item_costs: { T119: 1.5 },
      iteration_log: [],
    });
    mockCompute.mockReturnValue({
      taskId: "T119",
      durationMs: 5 * 3_600_000,
      planStartIso: "2026-04-27T09:00:00Z",
      mergeEndIso: "2026-04-27T14:00:00Z",
      phaseBreakdown: [],
      formattedDuration: "5h",
      costUsd: 1.5,
      hourlyRate: "$0.30/hr",
    });

    const res = await GET(makeReq("0", "T119"), makeCtx("0", "T119"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.taskId).toBe("T119");
    expect(json.data.durationMs).toBe(5 * 3_600_000);
    expect(json.data.formattedDuration).toBe("5h");
    expect(json.data.hourlyRate).toBe("$0.30/hr");

    // Verify cost was passed from item_costs
    const callArgs = mockCompute.mock.calls[0];
    expect(callArgs[1]).toBe("T119");
    expect(callArgs[2]).toBe(1.5);
  });

  it("returns 200 with null durationMs when task is not in log", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockReadState.mockResolvedValue({ item_costs: {}, iteration_log: [] });
    mockCompute.mockReturnValue({
      taskId: "T999",
      durationMs: null,
      planStartIso: null,
      mergeEndIso: null,
      phaseBreakdown: [],
      formattedDuration: null,
      costUsd: null,
      hourlyRate: null,
    });

    const res = await GET(makeReq("0", "T999"), makeCtx("0", "T999"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.durationMs).toBeNull();
    expect(json.error).toBeUndefined();
  });

  it("returns 500 when readState throws", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockReadState.mockRejectedValue(new Error("boom"));

    const res = await GET(makeReq("0", "T119"), makeCtx("0", "T119"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("boom");
  });

  it("passes undefined cost to compute when item_costs missing", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockReadState.mockResolvedValue(null);
    mockCompute.mockReturnValue({
      taskId: "T119",
      durationMs: null,
      planStartIso: null,
      mergeEndIso: null,
      phaseBreakdown: [],
      formattedDuration: null,
      costUsd: null,
      hourlyRate: null,
    });

    const res = await GET(makeReq("0", "T119"), makeCtx("0", "T119"));
    expect(res.status).toBe(200);
    const callArgs = mockCompute.mock.calls[0];
    expect(callArgs[0]).toBeNull();
    expect(callArgs[2]).toBeUndefined();
  });

  it("response wraps result in { data } envelope", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockReadState.mockResolvedValue({ item_costs: {} });
    mockCompute.mockReturnValue({
      taskId: "T119",
      durationMs: 60_000,
      planStartIso: "2026-04-27T10:00:00Z",
      mergeEndIso: "2026-04-27T10:01:00Z",
      phaseBreakdown: [],
      formattedDuration: "1m",
      costUsd: null,
      hourlyRate: null,
    });

    const res = await GET(makeReq("0", "T119"), makeCtx("0", "T119"));
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).not.toHaveProperty("error");
    expect(json.data.taskId).toBe("T119");
  });
});
