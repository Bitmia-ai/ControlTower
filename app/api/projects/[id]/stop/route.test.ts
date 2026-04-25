import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

const mockStopSession = vi.fn();
vi.mock("@/lib/session-manager", () => ({
  stopSession: (...args: unknown[]) => mockStopSession(...args),
}));

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

// Stub the git commit+push helper so tests don't shell out to git.
vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true, pushed: true })),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/stop`, {
    method: "POST",
  });
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("POST /api/projects/[id]/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue("# Steering\n\n## Directives\n\n");
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("writes STOP directive under ## Directives with canonical format", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).toMatch(/## Directives/);
    expect(written).toMatch(
      /STOP — CEO directed stop at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    );
  });

  it("does NOT call stopSession", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0");
    await POST(req, ctx);
    expect(mockStopSession).not.toHaveBeenCalled();
  });

  it("creates ## Directives section when steering.md lacks one", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadFile.mockResolvedValue("# Steering\n\nSome other text\n");
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).toMatch(/## Directives/);
    expect(written).toMatch(/STOP — CEO directed stop at /);
  });

  it("creates steering.md when file does not exist (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).toMatch(/## Directives/);
    expect(written).toMatch(/STOP — CEO directed stop at /);
  });

  it("returns 500 JSON when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockWriteFile.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk full");
  });
});
