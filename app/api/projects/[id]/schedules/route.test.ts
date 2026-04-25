import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

// Mock fs/promises so we can control file reads
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/schedules`);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

const SAMPLE_MD = `# Scheduled Tasks

### SCHED-001: Weekly security audit
- **Frequency:** every 7d
- **Last run:** 2026-04-18T10:00:00Z
- **Task:**
  1. Review recent commits
  2. Check for outdated deps
- **Assigned to:** Security Reviewer
`;

describe("GET /api/projects/[id]/schedules", () => {
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

  it("returns 200 with empty schedules when schedules.md is absent (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    const enoentError = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoentError);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ schedules: [] });
  });

  it("returns 200 with empty schedules when file has no SCHED- blocks", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockResolvedValue("# Scheduled Tasks\n\n_(No tasks yet.)_\n");
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedules).toEqual([]);
  });

  it("returns 200 with parsed schedules on happy path", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.schedules).toHaveLength(1);
    const s = json.data.schedules[0];
    expect(s.id).toBe("SCHED-001");
    expect(s.title).toBe("Weekly security audit");
    expect(s.frequency).toBe("every 7d");
    expect(s.lastRunIso).toBe("2026-04-18T10:00:00Z");
    expect(s.steps).toHaveLength(2);
    expect(s.assignedTo).toBe("Security Reviewer");
  });

  it("returns 500 when readFile throws a non-ENOENT error", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/testproject" });
    mockReadFile.mockRejectedValue(new Error("permission denied"));
    const [req, ctx] = makeRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("reads schedules.md from the project .redeye directory", async () => {
    const projectPath = "/tmp/myproject";
    mockGetProject.mockResolvedValue({ name: "p", path: projectPath });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeRequest("1");
    await GET(req, ctx);
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining(".redeye/schedules.md"),
      "utf-8"
    );
  });
});
