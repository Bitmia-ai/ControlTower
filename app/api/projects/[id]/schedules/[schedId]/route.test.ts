import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/redeye-files", () => ({
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
}));

vi.mock("@/lib/atomic-write", () => ({
  atomicWriteJson: vi.fn(async () => undefined),
}));

vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true })),
}));

import { DELETE } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { atomicWriteJson } from "@/lib/atomic-write";
import fs from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;
const mockAtomicWriteJson = atomicWriteJson as ReturnType<typeof vi.fn>;

const SAMPLE_MD = `# Scheduled Tasks

### SCHED-1: Weekly audit
- **Frequency:** every 7d
- **Last run:** 2026-01-01T00:00:00Z
- **Task:**
  1. Review commits
- **Assigned to:** CTO

### SCHED-2: Daily digest
- **Frequency:** every 1d
- **Last run:** 2026-04-20T00:00:00Z
- **Task:**
  1. Post summary
- **Assigned to:** CTO
`;

function makeDelete(
  id: string,
  schedId: string
): [NextRequest, { params: Promise<{ id: string; schedId: string }> }] {
  const req = new NextRequest(
    `http://localhost:3200/api/projects/${id}/schedules/${schedId}`,
    { method: "DELETE" }
  );
  const params = Promise.resolve({ id, schedId });
  return [req, { params }];
}

describe("DELETE /api/projects/[id]/schedules/[schedId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAtomicWriteJson.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid schedId format", async () => {
    const [req, ctx] = makeDelete("0", "INVALID");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
  });

  it("returns 400 for schedId with no number", async () => {
    const [req, ctx] = makeDelete("0", "SCHED-");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeDelete("99", "SCHED-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/project/i);
  });

  it("returns 404 when schedules.md does not exist", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(enoent);
    const [req, ctx] = makeDelete("0", "SCHED-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/schedules\.md/i);
  });

  it("returns 404 when the schedule block is not found in the file", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeDelete("0", "SCHED-99");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 200 and removes SCHED-1 successfully", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeDelete("0", "SCHED-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(json.data.deleted).toBe("SCHED-1");
  });

  it("delegates write to atomicWriteJson with correct path and content", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeDelete("0", "SCHED-1");
    await DELETE(req, ctx);
    expect(mockAtomicWriteJson).toHaveBeenCalledOnce();
    const [writtenPath, writtenContent] = mockAtomicWriteJson.mock.calls[0] as [
      string,
      string,
    ];
    expect(writtenPath).toMatch(/schedules\.md$/);
    expect(writtenPath).not.toMatch(/\.tmp$/);
    expect(writtenContent).not.toContain("### SCHED-1:");
    expect(writtenContent).toContain("### SCHED-2:");
  });

  it("written content no longer contains the deleted schedule", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockResolvedValue(SAMPLE_MD);
    const [req, ctx] = makeDelete("0", "SCHED-1");
    await DELETE(req, ctx);
    const written = mockAtomicWriteJson.mock.calls[0][1] as string;
    expect(written).not.toContain("### SCHED-1:");
    expect(written).toContain("### SCHED-2:");
  });

  it("returns 500 on unexpected readFile error", async () => {
    mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
    mockReadFile.mockRejectedValue(new Error("permission denied"));
    const [req, ctx] = makeDelete("0", "SCHED-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(500);
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("DELETE returns 400 for non-numeric id", async () => {
    const [req, ctx] = makeDelete("abc", "SCHED-1");
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
