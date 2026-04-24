import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  removeProject: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  readProjectDetail: vi.fn(),
  isInitialized: vi.fn(),
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
}));

vi.mock("@/lib/transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
}));

import { GET, DELETE } from "./route";
import { getProjectByIndex, removeProject } from "@/lib/projects";
import { readProjectDetail, isInitialized } from "@/lib/redeye-files";
import { getSessionStatus } from "@/lib/session-manager";
import { resolveTranscriptFile } from "@/lib/transcript-file-resolver";

const mockResolveTranscript = resolveTranscriptFile as ReturnType<typeof vi.fn>;

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockRemove = removeProject as ReturnType<typeof vi.fn>;
const mockReadDetail = readProjectDetail as ReturnType<typeof vi.fn>;
const mockIsInit = isInitialized as ReturnType<typeof vi.fn>;
const mockSessionStatus = getSessionStatus as ReturnType<typeof vi.fn>;

function makeGet(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}`);
  return [req, { params: Promise.resolve({ id }) }];
}

function makeDelete(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}`, {
    method: "DELETE",
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeGet("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockSessionStatus.mockReturnValue({ cto: { status: "idle" } });
    mockIsInit.mockResolvedValue(true);
    mockResolveTranscript.mockReturnValue(null);
    mockReadDetail.mockResolvedValue({ project: { name: "t" }, backlog: [] });
    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.project).toBeDefined();
  });

  it("exposes hasTranscript=true when a transcript file is available", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockSessionStatus.mockReturnValue({ cto: { status: "idle" } });
    mockIsInit.mockResolvedValue(true);
    mockResolveTranscript.mockReturnValue("/fake/transcript.jsonl");
    mockReadDetail.mockImplementation(async (_path: string, project: unknown) => ({
      project,
      backlog: [],
    }));
    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.project.hasTranscript).toBe(true);
  });

  it("exposes hasTranscript=false when no transcript is available", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockSessionStatus.mockReturnValue({ cto: { status: "idle" } });
    mockIsInit.mockResolvedValue(true);
    mockResolveTranscript.mockReturnValue(null);
    mockReadDetail.mockImplementation(async (_path: string, project: unknown) => ({
      project,
      backlog: [],
    }));
    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.project.hasTranscript).toBe(false);
  });

  it("returns 500 JSON when readProjectDetail throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockSessionStatus.mockReturnValue({ cto: { status: "idle" } });
    mockIsInit.mockResolvedValue(true);
    mockReadDetail.mockRejectedValue(new Error("read failed"));
    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("read failed");
  });

  it("returns 500 JSON when isInitialized throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockSessionStatus.mockReturnValue({ cto: { status: "idle" } });
    mockIsInit.mockRejectedValue(new Error("init check failed"));
    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("init check failed");
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeDelete("99");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockRemove.mockResolvedValue(undefined);
    const [req, ctx] = makeDelete("0");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it("returns 500 JSON when removeProject throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockRemove.mockRejectedValue(new Error("remove failed"));
    const [req, ctx] = makeDelete("0");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("remove failed");
  });
});
