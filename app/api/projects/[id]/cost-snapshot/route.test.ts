import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing the route
vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
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
  backlog_item: "BL-020",
  backlog_title: "Test",
  spec_file: null,
  review_cycles: 0,
  health: {
    confidence: "HIGH",
    env_status: "healthy",
    iterations_since_last_deploy: 0,
    questions_awaiting_ceo: 0,
    blocked_items_count: 0,
  },
  counters: { next_bl_id: 1, next_q_id: 1 },
};

describe("POST /api/projects/[id]/cost-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { blId: "BL-020" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when blId is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    const [req, ctx] = makeRequest("0", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/blId/);
  });

  it("returns 400 when blId is not a string", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    const [req, ctx] = makeRequest("0", { blId: 42 });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 200 with blId and cost_usd on success", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(1.42);

    const [req, ctx] = makeRequest("0", { blId: "BL-020" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.blId).toBe("BL-020");
    expect(json.data.cost_usd).toBe(1.42);
    expect(json.data.recorded).toBe(true);
  });

  it("does NOT write state.json when cost_usd is 0 and no start baseline (no transcript)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    // State has no item_cost_starts entry for this blId
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0);

    const [req, ctx] = makeRequest("0", { blId: "BL-042" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ blId: "BL-042", cost_usd: 0, recorded: false });

    // State was read (to check for start baseline) but NOT written
    expect(mockReadFile).toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
  });

  it("writes cost into state.json item_costs", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.38);

    const [req, ctx] = makeRequest("0", { blId: "BL-016" });
    await POST(req, ctx);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs).toEqual({ "BL-016": 0.38 });
    // Other fields must not be corrupted
    expect(written.iteration).toBe(1);
    expect(written.phase).toBe("BUILD");
  });

  it("initialises item_costs map when not present in state", async () => {
    const stateWithoutCosts = { ...baseState };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithoutCosts));
    mockSumCost.mockResolvedValue(0.21);

    const [req, ctx] = makeRequest("0", { blId: "BL-019" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs).toEqual({ "BL-019": 0.21 });
  });

  it("overwrites existing entry (idempotent — last call wins)", async () => {
    const stateWithExisting = {
      ...baseState,
      item_costs: { "BL-015": 1.42, "BL-016": 0.30 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithExisting));
    mockSumCost.mockResolvedValue(0.38);

    const [req, ctx] = makeRequest("0", { blId: "BL-016" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["BL-016"]).toBeCloseTo(0.38);
    // Other entries must be preserved
    expect(written.item_costs["BL-015"]).toBe(1.42);
  });

  it("uses atomic write (write to tmp then rename)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.05);

    const [req, ctx] = makeRequest("0", { blId: "BL-020" });
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

  // ─── BL-046: delta math when item_cost_starts[blId] exists ──────────────

  it("stores delta (current - start) when item_cost_starts[blId] exists", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 0.50 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.75);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBeCloseTo(1.25, 5);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["BL-050"]).toBeCloseTo(1.25, 5);
  });

  it("clamps delta to 0 when current < start (transcript rotation) and still records", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 2.0 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0.3); // rotated — lower value

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(0);
    expect(json.data.recorded).toBe(true);

    // The task ran — we record 0 rather than skip, because a start existed
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["BL-050"]).toBe(0);
  });

  it("clears item_cost_starts[blId] after successful delta write", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 0.50, "BL-051": 0.10 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.75);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    // BL-050 cleared
    expect(written.item_cost_starts["BL-050"]).toBeUndefined();
    // BL-051 preserved (unrelated start still waiting)
    expect(written.item_cost_starts["BL-051"]).toBe(0.10);
  });

  it("backward compat: stores raw current cost when no item_cost_starts entry exists", async () => {
    // State has neither item_cost_starts nor prior item_costs for this blId
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(3.14);

    const [req, ctx] = makeRequest("0", { blId: "BL-099" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(3.14);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_costs["BL-099"]).toBe(3.14);
  });

  it("clears item_cost_starts[blId] even when delta is 0 (transcript rotation)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 2.0 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0.3);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts["BL-050"]).toBeUndefined();
  });

  it("clears item_cost_starts[blId] and records delta=0 when current_cost=0 and start exists (fully absent transcript)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 1.5 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(0); // transcript gone entirely

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    const json = await res.json();

    // Should proceed (not early-exit) because hasStart=true
    expect(json.data.recorded).toBe(true);
    expect(json.data.cost_usd).toBe(0);

    // Baseline must be cleared
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts?.["BL-050"]).toBeUndefined();
    expect(written.item_costs?.["BL-050"]).toBe(0);
  });
});
