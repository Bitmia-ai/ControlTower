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
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/cost-snapshot`, {
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
  task_id: "T020",
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

describe("POST /api/projects/[id]/cost-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { taskId: "T020" });
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

  it("returns 200 with taskId and cost_usd on success", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(1.42);

    const [req, ctx] = makeRequest("0", { taskId: "T020" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.taskId).toBe("T020");
    expect(json.data.cost_usd).toBe(1.42);
    expect(json.data.recorded).toBe(true);
  });

  it("does NOT write state.json when cost_usd is 0 and no start baseline (no transcript)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    // State has no item_cost_starts entry for this taskId
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0);

    const [req, ctx] = makeRequest("0", { taskId: "T042" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ taskId: "T042", cost_usd: 0, recorded: false });

    // State was read (to check for start baseline) but NOT written
    expect(mockReadFile).toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
  });

  it("writes cost into state.json item_costs", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.38);

    const [req, ctx] = makeRequest("0", { taskId: "T016" });
    await POST(req, ctx);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs).toEqual({ "T016": 0.38 });
    // Other fields must not be corrupted
    expect(written.iteration).toBe(1);
    expect(written.phase).toBe("BUILD");
  });

  it("initialises item_costs map when not present in state", async () => {
    const stateWithoutCosts = { ...baseState };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithoutCosts));
    mockSumCost.mockResolvedValue(0.21);

    const [req, ctx] = makeRequest("0", { taskId: "T019" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs).toEqual({ "T019": 0.21 });
  });

  it("overwrites existing entry (idempotent — last call wins)", async () => {
    const stateWithExisting = {
      ...baseState,
      item_costs: { "T015": 1.42, "T016": 0.30 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithExisting));
    mockSumCost.mockResolvedValue(0.38);

    const [req, ctx] = makeRequest("0", { taskId: "T016" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["T016"]).toBeCloseTo(0.38);
    // Other entries must be preserved
    expect(written.item_costs["T015"]).toBe(1.42);
  });

  it("uses atomic write (write to tmp then rename)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.05);

    const [req, ctx] = makeRequest("0", { taskId: "T020" });
    await POST(req, ctx);

    // tmp file is written first
    expect(mockWriteFile).toHaveBeenCalledOnce();
    const tmpPath = mockWriteFile.mock.calls[0][0] as string;
    expect(tmpPath).toContain(".tmp.");

    // then renamed to the canonical state.json path
    expect(mockRename).toHaveBeenCalledOnce();
    const [from, to] = mockRename.mock.calls[0] as [string, string];
    expect(from).toBe(tmpPath);
    expect(to).toMatch(/state\.json$/);
  });

  // ─── T046: delta math when item_cost_starts[taskId] exists ──────────────

  it("stores delta (current - start) when item_cost_starts[taskId] exists", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 0.50 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.75);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBeCloseTo(1.25, 5);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["T050"]).toBeCloseTo(1.25, 5);
  });

  it("clamps delta to 0 when current < start (transcript rotation) and still records", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 2.0 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0.3); // rotated — lower value

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(0);
    expect(json.data.recorded).toBe(true);

    // The task ran — we record 0 rather than skip, because a start existed
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["T050"]).toBe(0);
  });

  it("clears item_cost_starts[taskId] after successful delta write", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 0.50, "T051": 0.10 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.75);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    // T050 cleared
    expect(written.item_cost_starts["T050"]).toBeUndefined();
    // T051 preserved (unrelated start still waiting)
    expect(written.item_cost_starts["T051"]).toBe(0.10);
  });

  it("backward compat: stores raw current cost when no item_cost_starts entry exists", async () => {
    // State has neither item_cost_starts nor prior item_costs for this taskId
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(3.14);

    const [req, ctx] = makeRequest("0", { taskId: "T099" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(3.14);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["T099"]).toBe(3.14);
  });

  it("clears item_cost_starts[taskId] even when delta is 0 (transcript rotation)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 2.0 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0.3);

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts["T050"]).toBeUndefined();
  });

  it("serializes 2 concurrent cost-snapshot calls for different taskIds without losing item_costs entries", async () => {
    // Regression for T149: without withProjectLock, two concurrent
    // cost-snapshot requests would each read the same item_costs map,
    // each compute a new map with their own taskId added, and each write
    // back — the second write would lose the first request's entry.
    // With the mutex, both entries must survive.
    const startState = {
      ...baseState,
      item_costs: {} as Record<string, number>,
      item_cost_starts: { "T201": 5, "T202": 10 } as Record<string, number>,
    };

    mockGetProject.mockResolvedValue({ name: "test", path: "/concurrent-cost-snap" });

    // Shared on-disk state, mutated by atomicWriteJson via writeFile→rename.
    const diskState: typeof startState = JSON.parse(JSON.stringify(startState));
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
          // Replace fields we mutate; preserve everything else by deep-copying.
          diskState.item_costs = parsed.item_costs ?? {};
          diskState.item_cost_starts = parsed.item_cost_starts ?? {};
        }
      }
    });
    // current_session_cost: T201 finishes at 7 (delta 2), T202 at 12 (delta 2).
    mockSumCost.mockImplementation(async () => 12);

    const [reqA, ctxA] = makeRequest("0", { taskId: "T201" });
    const [reqB, ctxB] = makeRequest("0", { taskId: "T202" });
    const [resA, resB] = await Promise.all([POST(reqA, ctxA), POST(reqB, ctxB)]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    // Both task entries must be present in the final on-disk state.
    expect(diskState.item_costs?.["T201"]).toBeDefined();
    expect(diskState.item_costs?.["T202"]).toBeDefined();
    // And both starts cleared.
    expect(diskState.item_cost_starts?.["T201"]).toBeUndefined();
    expect(diskState.item_cost_starts?.["T202"]).toBeUndefined();
  });

  it("clears item_cost_starts[taskId] and records delta=0 when current_cost=0 and start exists (fully absent transcript)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "T050": 1.5 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0); // transcript gone entirely

    const [req, ctx] = makeRequest("0", { taskId: "T050" });
    const res = await POST(req, ctx);
    const json = await res.json();

    // Should proceed (not early-exit) because hasStart=true
    expect(json.data.recorded).toBe(true);
    expect(json.data.cost_usd).toBe(0);

    // Baseline must be cleared
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts?.["T050"]).toBeUndefined();
    expect(written.item_costs?.["T050"]).toBe(0);
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
