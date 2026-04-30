import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/cost-history", () => ({
  getSessionHistory: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionHistory } from "@/lib/cost-history";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockGetHistory = getSessionHistory as ReturnType<typeof vi.fn>;

function makeRequest(id: string, query = ""): [NextRequest, { params: Promise<{ id: string }> }] {
  const url = `http://localhost:3200/api/projects/${id}/session-history${query}`;
  const req = new NextRequest(url);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("GET /api/projects/[id]/session-history", () => {
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

  it("returns 200 with empty sessions array when no history", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockGetHistory.mockResolvedValue([]);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ sessions: [] });
  });

  it("returns 200 with sessions payload on happy path", async () => {
    const sessions = [
      {
        file: "a.jsonl",
        cost: 0.1,
        mtimeMs: 1000,
        startedAt: 500,
        durationMs: 500,
        phases: ["PLAN", "BUILD"],
        iterationSummaries: [],
      },
      {
        file: "b.jsonl",
        cost: 0.2,
        mtimeMs: 2000,
        startedAt: 1500,
        durationMs: 500,
        phases: ["BUILD"],
        iterationSummaries: [],
      },
    ];
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockGetHistory.mockResolvedValue(sessions);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.sessions).toEqual(sessions);
  });

  it("passes iterationSummaries through unchanged (T128)", async () => {
    const sessions = [
      {
        file: "a.jsonl",
        cost: 0.1,
        mtimeMs: 1000,
        startedAt: 500,
        durationMs: 500,
        phases: ["BUILD"],
        iterationSummaries: [
          {
            iteration: 42,
            outcome: "T128 wired Activity panel",
            phases: ["BUILD"],
          },
        ],
      },
    ];
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockGetHistory.mockResolvedValue(sessions);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.sessions[0].iterationSummaries).toEqual([
      { iteration: 42, outcome: "T128 wired Activity panel", phases: ["BUILD"] },
    ]);
  });

  it("returns 500 with error when getSessionHistory throws", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/p" });
    mockGetHistory.mockRejectedValue(new Error("disk failure"));
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("invokes getSessionHistory with project path and default limit", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/abs/path" });
    mockGetHistory.mockResolvedValue([]);
    const [req, ctx] = makeRequest("3");
    await GET(req, ctx);
    expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 50);
  });

  it("respects ?limit query parameter", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/abs/path" });
    mockGetHistory.mockResolvedValue([]);
    const [req, ctx] = makeRequest("3", "?limit=5");
    await GET(req, ctx);
    expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 5);
  });

  it("falls back to default limit when ?limit is invalid", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/abs/path" });
    mockGetHistory.mockResolvedValue([]);
    const [req, ctx] = makeRequest("3", "?limit=notanumber");
    await GET(req, ctx);
    expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 50);
  });

  describe("?limit clamping (T148)", () => {
    beforeEach(() => {
      mockGetProject.mockResolvedValue({ name: "p", path: "/abs/path" });
      mockGetHistory.mockResolvedValue([]);
    });

    it("clamps ?limit=999999 to MAX_LIMIT=200", async () => {
      const [req, ctx] = makeRequest("0", "?limit=999999");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 200);
    });

    it("passes ?limit=10 through unchanged", async () => {
      const [req, ctx] = makeRequest("0", "?limit=10");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 10);
    });

    it("uses DEFAULT_LIMIT=50 when no ?limit param is given", async () => {
      const [req, ctx] = makeRequest("0");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 50);
    });

    it("falls back to DEFAULT_LIMIT=50 for ?limit=0 (non-positive)", async () => {
      const [req, ctx] = makeRequest("0", "?limit=0");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 50);
    });

    it("falls back to DEFAULT_LIMIT=50 for ?limit=abc (NaN)", async () => {
      const [req, ctx] = makeRequest("0", "?limit=abc");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 50);
    });

    it("passes ?limit=200 (at ceiling) unchanged, not clamped down", async () => {
      const [req, ctx] = makeRequest("0", "?limit=200");
      await GET(req, ctx);
      expect(mockGetHistory).toHaveBeenCalledWith("/abs/path", 200);
    });
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
