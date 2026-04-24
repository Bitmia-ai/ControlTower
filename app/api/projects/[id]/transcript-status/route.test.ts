import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies at module scope
vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("@/lib/transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
}));

const mockStatSync = vi.fn();
vi.mock("fs", () => ({
  default: {
    statSync: (...args: unknown[]) => mockStatSync(...args),
  },
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { resolveTranscriptFile } from "@/lib/transcript-file-resolver";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockResolve = resolveTranscriptFile as ReturnType<typeof vi.fn>;

const PROJECT_PATH = "/Users/casa/haze";
const REDEYE_FILE = `${PROJECT_PATH}/.redeye/session-cto.jsonl`;
const CLI_FILE = "/Users/casa/.claude/projects/-Users-casa-haze/abc123.jsonl";

function makeGet(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/transcript-status`);
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]/transcript-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project is not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeGet("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns available:false, source:null when no transcript file exists", async () => {
    mockGetProject.mockResolvedValue({ name: "haze", path: PROJECT_PATH });
    mockResolve.mockReturnValue(null);

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.source).toBeNull();
    expect(json.mtime).toBeNull();
    expect(json.ageSeconds).toBeNull();
  });

  it("returns available:true, source:'redeye' for .redeye/session-cto.jsonl", async () => {
    const now = Date.now();
    mockGetProject.mockResolvedValue({ name: "haze", path: PROJECT_PATH });
    mockResolve.mockReturnValue(REDEYE_FILE);
    mockStatSync.mockReturnValue({ mtimeMs: now - 10_000 }); // 10s ago

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
    expect(json.source).toBe("redeye");
    expect(json.mtime).toBeTruthy();
    expect(json.ageSeconds).toBeGreaterThanOrEqual(9);
    expect(json.ageSeconds).toBeLessThan(15);
  });

  it("returns available:true, source:'cli' for CLI transcript files", async () => {
    const now = Date.now();
    mockGetProject.mockResolvedValue({ name: "haze", path: PROJECT_PATH });
    mockResolve.mockReturnValue(CLI_FILE);
    mockStatSync.mockReturnValue({ mtimeMs: now - 300_000 }); // 5 minutes ago

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
    expect(json.source).toBe("cli");
    expect(json.ageSeconds).toBeGreaterThanOrEqual(299);
  });

  it("returns available:false when resolveTranscriptFile returns a stale file that can't be stat'd", async () => {
    mockGetProject.mockResolvedValue({ name: "haze", path: PROJECT_PATH });
    mockResolve.mockReturnValue(CLI_FILE);
    mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(json.source).toBeNull();
  });

  it("returns correct shape with all required fields", async () => {
    const now = Date.now();
    mockGetProject.mockResolvedValue({ name: "haze", path: PROJECT_PATH });
    mockResolve.mockReturnValue(CLI_FILE);
    mockStatSync.mockReturnValue({ mtimeMs: now - 30_000 });

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json).toHaveProperty("available");
    expect(json).toHaveProperty("source");
    expect(json).toHaveProperty("mtime");
    expect(json).toHaveProperty("ageSeconds");
  });
});
