import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing the route
vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/cost-calculator", () => ({
  sumCurrentSessionCost: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { sumCurrentSessionCost } from "@/lib/cost-calculator";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockSumCost = sumCurrentSessionCost as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = fs.writeFile as ReturnType<typeof vi.fn>;
const mockRename = fs.rename as ReturnType<typeof vi.fn>;

function makeRequest(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/cost-start`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return [req, { params: Promise.resolve({ id }) }];
}

const baseState = {
  iteration: 1,
  phase: "BUILD",
  phase_status: "in-progress",
  task_id: "T050",
  task_title: "Test",
  spec_file: null,
  review_cycles: 0,
  health: {
    confidence: "HIGH",
    env_status: "healthy",
    iterations_since_last_deploy: 0,
    questions_awaiting_ceo: 0,
    blocked_items_count: 0,
  },
  counters: { next_task_id: 1, next_q_id: 1 },
};

describe("POST /api/projects/[id]/cost-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when taskId is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    const [req, ctx] = makeRequest("0", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/taskId/);
  });

  it("returns 400 when taskId is not a string", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    const [req, ctx] = makeRequest("0", { taskId: 42 });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("writes cost_at_start into state.json on first record", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(1.25);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.taskId).toBe("T050");
    expect(json.data.cost_at_start).toBe(1.25);
    expect(json.data.recorded).toBe(true);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "T050": 1.25 });
  });

  it("writes 0 as baseline when current session cost is 0 (new session)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0);

    const [req, ctx] = makeRequest("0", { taskId: "T051" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_at_start).toBe(0);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "T051": 0 });
  });

  it("skips write when item_cost_starts[taskId] already exists (idempotent)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 0.5 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.25);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ taskId: "T050", skipped: true });

    // No write — guard prevented it
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
    // sumCurrentSessionCost should not even be called when guard trips
    expect(mockSumCost).not.toHaveBeenCalled();
  });

  it("returns 500 when state.json cannot be read", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
  });

  it("uses atomic write (tmp file + rename) matching cost-snapshot pattern", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.42);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    await POST(req, ctx);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const tmpPath = mockWriteFile.mock.calls[0][0] as string;
    expect(tmpPath).toContain(".tmp.");

    expect(mockRename).toHaveBeenCalledOnce();
    const [from, to] = mockRename.mock.calls[0] as [string, string];
    expect(from).toBe(tmpPath);
    expect(to).toMatch(/state\.json$/);
  });

  it("serializes 2 concurrent cost-start calls for the same taskId — idempotency guard fires on the second", async () => {
    // Regression for T149: without withProjectLock, two concurrent
    // cost-start requests for the same taskId would both read state with
    // item_cost_starts[taskId] === undefined, both pass the guard, and
    // both call atomicWriteJson — double-writing the baseline.
    // With the mutex, the first request commits before the second reads,
    // so the second sees the committed baseline and skips.
    mockGetProject.mockResolvedValue({ name: "test", path: "/concurrent-cost-start" });

    const diskState: typeof baseState & { item_cost_starts?: Record<string, number> } = {
      ...JSON.parse(JSON.stringify(baseState)),
    };
    const pendingTempWrites = new Map<string, string>();

    mockReadFile.mockImplementation(async (p: string) => {
      if (p.endsWith("state.json")) return JSON.stringify(diskState);
      throw new Error("unexpected read: " + p);
    });
    mockWriteFile.mockImplementation(async (p: string, content: string) => {
      pendingTempWrites.set(p, content);
    });
    mockRename.mockImplementation(async (src: string, dst: string) => {
      if (dst.endsWith("state.json")) {
        const content = pendingTempWrites.get(src);
        pendingTempWrites.delete(src);
        if (content !== undefined) {
          const parsed = JSON.parse(content);
          diskState.item_cost_starts = parsed.item_cost_starts ?? {};
        }
      }
    });
    mockSumCost.mockResolvedValue(0.42);

    const [reqA, ctxA] = makeRequest("0", { taskId: "T299" });
    const [reqB, ctxB] = makeRequest("0", { taskId: "T299" });
    const [resA, resB] = await Promise.all([POST(reqA, ctxA), POST(reqB, ctxB)]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Exactly one writeFile (and one rename) — the second request hit
    // the idempotency guard inside the lock.
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);

    const jsonA = await resA.json();
    const jsonB = await resB.json();
    // One recorded, one skipped — order can be either depending on
    // which Promise resolves first into the mutex queue.
    const outcomes = [jsonA.data, jsonB.data].map((d) =>
      d.recorded ? "recorded" : d.skipped ? "skipped" : "other",
    );
    expect(outcomes.sort()).toEqual(["recorded", "skipped"]);

    expect(diskState.item_cost_starts?.["T299"]).toBe(0.42);
  });

  it("preserves other state fields and existing item_cost_starts entries on write", async () => {
    const stateWithOther = {
      ...baseState,
      item_cost_starts: { "T049": 0.1 },
      item_costs: { "T048": 0.8 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithOther));
    mockSumCost.mockResolvedValue(2.0);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "T049": 0.1, "T050": 2.0 });
    expect(written.item_costs).toEqual({ "T048": 0.8 });
    expect(written.iteration).toBe(1);
    expect(written.phase).toBe("BUILD");
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc", { taskId: "T1" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
