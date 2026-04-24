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
  backlog_item: "BL-050",
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

describe("POST /api/projects/[id]/cost-start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { blId: "BL-050" });
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

  it("writes cost_at_start into state.json on first record", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(1.25);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.blId).toBe("BL-050");
    expect(json.data.cost_at_start).toBe(1.25);
    expect(json.data.recorded).toBe(true);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "BL-050": 1.25 });
  });

  it("writes 0 as baseline when current session cost is 0 (new session)", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0);

    const [req, ctx] = makeRequest("0", { blId: "BL-051" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_at_start).toBe(0);
    expect(json.data.recorded).toBe(true);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "BL-051": 0 });
  });

  it("skips write when item_cost_starts[blId] already exists (idempotent)", async () => {
    const stateWithStart = {
      ...baseState,
      item_cost_starts: { "BL-050": 0.5 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithStart));
    mockSumCost.mockResolvedValue(1.25);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ blId: "BL-050", skipped: true });

    // No write — guard prevented it
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
    // sumCurrentSessionCost should not even be called when guard trips
    expect(mockSumCost).not.toHaveBeenCalled();
  });

  it("returns 500 when state.json cannot be read", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
  });

  it("uses atomic write (tmp file + rename) matching cost-snapshot pattern", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(baseState));
    mockSumCost.mockResolvedValue(0.42);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    await POST(req, ctx);

    expect(mockWriteFile).toHaveBeenCalledOnce();
    const tmpPath = mockWriteFile.mock.calls[0][0] as string;
    expect(tmpPath).toContain(".tmp.");

    expect(mockRename).toHaveBeenCalledOnce();
    const [from, to] = mockRename.mock.calls[0] as [string, string];
    expect(from).toBe(tmpPath);
    expect(to).toMatch(/state\.json$/);
  });

  it("preserves other state fields and existing item_cost_starts entries on write", async () => {
    const stateWithOther = {
      ...baseState,
      item_cost_starts: { "BL-049": 0.1 },
      item_costs: { "BL-048": 0.8 },
    };
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockReadFile.mockResolvedValue(JSON.stringify(stateWithOther));
    mockSumCost.mockResolvedValue(2.0);

    const [req, ctx] = makeRequest("0", { blId: "BL-050" });
    await POST(req, ctx);

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    const written = JSON.parse(writtenContent);
    expect(written.item_cost_starts).toEqual({ "BL-049": 0.1, "BL-050": 2.0 });
    expect(written.item_costs).toEqual({ "BL-048": 0.8 });
    expect(written.iteration).toBe(1);
    expect(written.phase).toBe("BUILD");
  });
});
