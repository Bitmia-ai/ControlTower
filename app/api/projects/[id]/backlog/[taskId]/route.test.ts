import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

const mockReadBacklog = vi.fn();
const mockReadState = vi.fn();
vi.mock("@/lib/redeye-files", () => ({
  readBacklog: (...args: unknown[]) => mockReadBacklog(...args),
  readState: (...args: unknown[]) => mockReadState(...args),
}));

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

import { GET, PATCH, DELETE } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeCtx(id: string, taskId: string) {
  return { params: Promise.resolve({ id, taskId }) };
}

function makeReq(method: string, id: string, taskId: string, body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3200/api/projects/${id}/backlog/${taskId}`,
    {
      method,
      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
          }
        : {}),
    }
  );
}

const SAMPLE_BACKLOG = `# Backlog

## CEO Requests

### BL-001: First item
- **Priority:** P1
- **Details:**
  - some detail

### BL-002: Second item
- **Priority:** P2
- **Details:**
  - another detail

## Done
`;

describe("GET /api/projects/[id]/backlog/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "99", "BL-001"), makeCtx("99", "BL-001"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([{ id: "BL-001", title: "x", priority: "P1" }]);
    mockReadState.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "0", "BL-999"), makeCtx("0", "BL-999"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with basic item when cost data absent", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([
      { id: "BL-001", title: "First", priority: "P1" },
    ]);
    mockReadState.mockResolvedValue({ item_costs: {} });
    const res = await GET(makeReq("GET", "0", "BL-001"), makeCtx("0", "BL-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("BL-001");
    expect(json.data.title).toBe("First");
    expect(json.data.cost_usd).toBeUndefined();
  });

  it("returns 200 with cost_usd enrichment when state has cost", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([
      { id: "BL-001", title: "First", priority: "P1" },
    ]);
    mockReadState.mockResolvedValue({ item_costs: { "BL-001": 1.23 } });
    const res = await GET(makeReq("GET", "0", "BL-001"), makeCtx("0", "BL-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(1.23);
  });
});

describe("PATCH /api/projects/[id]/backlog/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(SAMPLE_BACKLOG);
    mockWriteFile.mockResolvedValue(undefined);
    mockReadState.mockResolvedValue(null);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await PATCH(
      makeReq("PATCH", "99", "BL-001", { title: "new" }),
      makeCtx("99", "BL-001")
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates title on valid title update", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([
      { id: "BL-001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "BL-001", { title: "Updated title" }),
      makeCtx("0", "BL-001")
    );
    expect(res.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).toContain("### BL-001: Updated title");
  });

  it("returns 200 and updates priority on valid priority update", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([
      { id: "BL-001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "BL-001", { priority: "P3" }),
      makeCtx("0", "BL-001")
    );
    expect(res.status).toBe(200);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).toMatch(/### BL-001:[^\n]*\n- \*\*Priority:\*\* P3/);
  });

  it("returns 404 when backlog file is missing (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const res = await PATCH(
      makeReq("PATCH", "0", "BL-001", { title: "x" }),
      makeCtx("0", "BL-001")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found in backlog", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadBacklog.mockResolvedValue([
      { id: "BL-001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "BL-999", { title: "x" }),
      makeCtx("0", "BL-999")
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/projects/[id]/backlog/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(SAMPLE_BACKLOG);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE", "99", "BL-001"), makeCtx("99", "BL-001"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and writes updated backlog without the item", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const res = await DELETE(makeReq("DELETE", "0", "BL-001"), makeCtx("0", "BL-001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, written] = mockWriteFile.mock.calls[0];
    expect(written).not.toContain("### BL-001:");
    expect(written).toContain("### BL-002:");
  });

  it("returns 404 when backlog file is missing (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const res = await DELETE(makeReq("DELETE", "0", "BL-001"), makeCtx("0", "BL-001"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found in content", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const res = await DELETE(makeReq("DELETE", "0", "BL-999"), makeCtx("0", "BL-999"));
    expect(res.status).toBe(404);
  });
});
