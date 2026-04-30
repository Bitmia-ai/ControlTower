import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus } from "@/lib/session-manager";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockGetSessionStatus = getSessionStatus as ReturnType<typeof vi.fn>;

const PROJECT = { name: "haze", path: "/tmp/haze" };

const MOCK_STATUS = {
  cto: {
    role: "cto",
    pid: null,
    status: "stopped",
    lastActivity: null,
    logFile: "/tmp/haze/.redeye/session-cto.jsonl",
  },
  tester: {
    role: "tester",
    pid: null,
    status: "stopped",
    lastActivity: null,
    logFile: "/tmp/haze/.redeye/session-tester.jsonl",
  },
  documenter: {
    role: "documenter",
    pid: null,
    status: "stopped",
    lastActivity: null,
    logFile: "/tmp/haze/.redeye/session-documenter.jsonl",
  },
};

function makeGet(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/sessions`);
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project is missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeGet("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
    expect(mockGetSessionStatus).not.toHaveBeenCalled();
  });

  it("returns 200 with { data: sessionStatus } envelope on success", async () => {
    mockGetProject.mockResolvedValue(PROJECT);
    mockGetSessionStatus.mockReturnValue(MOCK_STATUS);

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(MOCK_STATUS);
    expect(mockGetSessionStatus).toHaveBeenCalledWith(PROJECT.path);
  });

  it("returns 500 with { error } envelope when getSessionStatus throws", async () => {
    mockGetProject.mockResolvedValue(PROJECT);
    mockGetSessionStatus.mockImplementation(() => {
      throw new Error("registry corrupted");
    });

    const [req, ctx] = makeGet("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("registry corrupted");
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeGet("abc");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
