import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeRequest(
  id: string,
  body: unknown,
  opts: { malformed?: boolean } = {}
): [NextRequest, { params: Promise<{ id: string }> }] {
  const payload = opts.malformed ? "not-json{" : JSON.stringify(body);
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/steer`, {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
  });
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("POST /api/projects/[id]/steer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: steering.md exists with a Directives header
    mockReadFile.mockResolvedValue("# Steering\n\n## Directives\n\n");
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { directive: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 if directive missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0", { directive: "focus" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it("returns 500 JSON when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockWriteFile.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makeRequest("0", { directive: "focus" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk full");
  });

  it("returns 500 JSON when body is malformed JSON", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0", {}, { malformed: true });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(typeof json.error).toBe("string");
  });
});
