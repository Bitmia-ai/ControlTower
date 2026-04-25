import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  readSteering: vi.fn(),
  // safeRedeyePath was added during the security hardening pass; mocked
  // here so steer's POST handler can resolve the steering.md path.
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
}));

// Use the real parser helpers — they're pure string transforms with no I/O.
vi.mock("@/lib/redeye-parsers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redeye-parsers")>();
  return actual;
});

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

import { GET, POST, PATCH, DELETE } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { readSteering } from "@/lib/redeye-files";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockReadSteering = readSteering as ReturnType<typeof vi.fn>;

function makePostRequest(
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

function makeGetRequest(
  id: string
): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/steer`);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

describe("GET /api/projects/[id]/steer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with directives list on happy path", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/proj" });
    mockReadSteering.mockResolvedValue([
      { text: "Focus on UX (2026-04-25)" },
      { text: "Ship faster (2026-04-24)" },
    ]);
    const [req, ctx] = makeGetRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.directives).toHaveLength(2);
    expect(json.data.directives[0].text).toContain("Focus on UX");
    expect(mockReadSteering).toHaveBeenCalledWith("/tmp/proj");
  });

  it("returns 200 with empty list when steering.md has no directives", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/proj" });
    mockReadSteering.mockResolvedValue([]);
    const [req, ctx] = makeGetRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.directives).toEqual([]);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeGetRequest("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 500 when readSteering throws", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/proj" });
    mockReadSteering.mockRejectedValue(new Error("permission denied"));
    const [req, ctx] = makeGetRequest("0");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("permission denied");
  });
});

describe("POST /api/projects/[id]/steer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: steering.md exists with a Directives header
    mockReadFile.mockResolvedValue("# Steering\n\n## Directives\n\n");
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 if project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makePostRequest("99", { directive: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 if directive missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makePostRequest("0", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makePostRequest("0", { directive: "focus" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it("returns 500 JSON when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockWriteFile.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makePostRequest("0", { directive: "focus" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("disk full");
  });

  it("returns 400 JSON when body is malformed JSON", async () => {
    // Was 500 before — readJsonBody now returns 400 (client error) on
    // parse failure, which is the correct status for invalid input.
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makePostRequest("0", {}, { malformed: true });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(typeof json.error).toBe("string");
  });
});

function makeMutateRequest(
  method: "PATCH" | "DELETE",
  id: string,
  body: unknown
): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/steer`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  const params = Promise.resolve({ id });
  return [req, { params }];
}

const STEERING_FIXTURE =
  `# Steering\n\n## Directives\n\n- first directive\n- second directive\n- third directive\n`;

describe("PATCH /api/projects/[id]/steer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(STEERING_FIXTURE);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeMutateRequest("PATCH", "99", { index: 0, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when index missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", { text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when index is negative", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: -1, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when index is not an integer", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: 1.5, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: 0 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text empty after sanitization", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    // Only control chars / whitespace → sanitized to empty.
    const [req, ctx] = makeMutateRequest("PATCH", "0", {
      index: 0,
      text: "\x00\x00",
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when index out of range", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: 99, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/out of range/i);
  });

  it("returns 404 when steering.md is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: 0, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 and writes the edited file on happy path", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("PATCH", "0", {
      index: 1,
      text: "second EDITED",
    });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    // writeFile was called with the file path + the patched content.
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).toContain("- first directive");
    expect(written).toContain("- second EDITED");
    expect(written).not.toContain("- second directive\n");
    expect(written).toContain("- third directive");
  });

  it("returns 500 when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockWriteFile.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makeMutateRequest("PATCH", "0", { index: 0, text: "x" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/projects/[id]/steer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(STEERING_FIXTURE);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeMutateRequest("DELETE", "99", { index: 0 });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when index missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("DELETE", "0", {});
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when index is a string", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("DELETE", "0", { index: "1" });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when index out of range", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("DELETE", "0", { index: 99 });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 404 when steering.md is missing", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);
    const [req, ctx] = makeMutateRequest("DELETE", "0", { index: 0 });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 200 and writes the file with the directive removed", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const [req, ctx] = makeMutateRequest("DELETE", "0", { index: 1 });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const written = mockWriteFile.mock.calls[0][1] as string;
    expect(written).toContain("- first directive");
    expect(written).not.toContain("- second directive");
    expect(written).toContain("- third directive");
  });

  it("returns 500 when writeFile throws", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockWriteFile.mockRejectedValue(new Error("disk full"));
    const [req, ctx] = makeMutateRequest("DELETE", "0", { index: 0 });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(500);
  });
});
