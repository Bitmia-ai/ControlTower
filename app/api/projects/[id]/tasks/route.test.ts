import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/task-id", () => ({
  getNextTaskId: vi.fn(),
}));

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

const mockAtomicWrite = vi.fn();
vi.mock("@/lib/atomic-write", () => ({
  atomicWriteJson: (...args: unknown[]) => mockAtomicWrite(...args),
}));

// Stub the git commit helper so tests don't shell out to git.
vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true })),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { getNextTaskId } from "@/lib/task-id";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockGetId = getNextTaskId as ReturnType<typeof vi.fn>;

function makeRequest(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return [req, { params: Promise.resolve({ id }) }];
}

describe("POST /api/projects/[id]/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tasks.md exists with a CEO Requests header
    mockReadFile.mockResolvedValue("# Tasks\n\n## CEO Requests\n\n## Done\n");
    mockWriteFile.mockResolvedValue(undefined);
    mockAtomicWrite.mockResolvedValue(undefined);
  });

  it("returns 404 when project missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeRequest("99", { text: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when text missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeRequest("0", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockGetId.mockResolvedValue("T042");
    const [req, ctx] = makeRequest("0", { text: "improve X" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(json.data.id).toBe("T042");
  });

  it("returns 500 JSON when getNextTaskId throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockGetId.mockRejectedValue(new Error("id alloc failed"));
    const [req, ctx] = makeRequest("0", { text: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 500 JSON when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockGetId.mockResolvedValue("T042");
    mockAtomicWrite.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makeRequest("0", { text: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk full");
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc", { text: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
