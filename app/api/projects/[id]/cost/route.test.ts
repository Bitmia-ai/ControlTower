import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock all external dependencies before importing the route
vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("@/lib/transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
  encodeProjectPath: vi.fn((p: string) => p.replace(/\//g, "-")),
}));

vi.mock("@/lib/cost-calculator", () => ({
  sumTranscriptFileCost: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    readdirSync: vi.fn(),
  },
  readdirSync: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { resolveTranscriptFile } from "@/lib/transcript-file-resolver";
import { sumTranscriptFileCost } from "@/lib/cost-calculator";
import * as fsMod from "fs";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockResolveFile = resolveTranscriptFile as ReturnType<typeof vi.fn>;
const mockSumCost = sumTranscriptFileCost as ReturnType<typeof vi.fn>;

function getReaddirMock() {
  // Access via both named and default exports for compatibility
  return (fsMod.readdirSync ?? (fsMod as unknown as { default: { readdirSync: ReturnType<typeof vi.fn> } }).default.readdirSync) as ReturnType<typeof vi.fn>;
}

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/cost`);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("GET /api/projects/[id]/cost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns { session: 0, total: 0 } when no transcript files exist", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockResolveFile.mockReturnValue(null);
    getReaddirMock().mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ session: 0, total: 0 });
  });

  it("returns session cost when transcript file exists", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockResolveFile.mockReturnValue("/home/.claude/projects/-test-project/abc.jsonl");
    mockSumCost.mockResolvedValue(1.23);
    getReaddirMock().mockReturnValue(["abc.jsonl"]);

    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.session).toBeCloseTo(1.23);
    expect(json.data.total).toBeGreaterThanOrEqual(json.data.session);
  });

  it("returns numeric data for valid project", async () => {
    mockGetProject.mockResolvedValue({ name: "my-project", path: "/my/project" });
    mockResolveFile.mockReturnValue("/home/.claude/projects/-my-project/latest.jsonl");
    mockSumCost.mockResolvedValue(0.05);
    getReaddirMock().mockReturnValue(["latest.jsonl", "old.jsonl"]);

    const [req, ctx] = makeRequest("1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.data.session).toBe("number");
    expect(typeof json.data.total).toBe("number");
    expect(json.data.total).toBeGreaterThanOrEqual(json.data.session);
  });

  it("ensures total >= session when readdirSync throws EACCES", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    // Session file is inside the encoded cliDir (so the guard won't add it separately)
    mockResolveFile.mockReturnValue(`${require("os").homedir()}/.claude/projects/-test-project/active.jsonl`);
    mockSumCost.mockResolvedValue(2.70);
    getReaddirMock().mockImplementation(() => {
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    });

    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.session).toBeCloseTo(2.70);
    expect(json.data.total).toBeGreaterThanOrEqual(json.data.session);
  });

  it("returns session: 0, total: 0 when cliDir exists but has no jsonl files", async () => {
    mockGetProject.mockResolvedValue({ name: "test", path: "/test/project" });
    mockResolveFile.mockReturnValue(null);
    getReaddirMock().mockReturnValue(["some-other-file.txt"]);

    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ session: 0, total: 0 });
  });
});
