import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
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
// atomicWriteJson is what the route now calls; proxy to mockWriteFile so the
// existing assertions on mockWriteFile.mock.calls keep working.
vi.mock("@/lib/atomic-write", () => ({
  atomicWriteJson: (path: string, content: string) => mockWriteFile(path, content),
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

  it("DOES call stopSession to actually halt the loop (regression: graceful-only stop was unreliable when the model was wedged on 2026-04-29)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockStopSession.mockResolvedValue(undefined);
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockStopSession).toHaveBeenCalledTimes(1);
    expect(mockStopSession).toHaveBeenCalledWith("/t", "cto");
  });

  it("calls stopSession AFTER writing the STOP directive (durable record before kill)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const callOrder: string[] = [];
    mockWriteFile.mockImplementation(async () => {
      callOrder.push("writeFile");
    });
    mockStopSession.mockImplementation(async () => {
      callOrder.push("stopSession");
    });
    const [req, ctx] = makeRequest("0");
    await POST(req, ctx);
    expect(callOrder).toEqual(["writeFile", "stopSession"]);
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

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
