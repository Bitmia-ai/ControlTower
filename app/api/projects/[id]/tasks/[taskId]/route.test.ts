import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

const mockReadTasks = vi.fn();
const mockReadState = vi.fn();
vi.mock("@/lib/redeye-files", () => ({
  readTasks: (...args: unknown[]) => mockReadTasks(...args),
  readState: (...args: unknown[]) => mockReadState(...args),
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
  // Empty archive: tests don't exercise the archive-fallback path.
  readArchivedTasks: () => Promise.resolve([]),
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

import { GET, PATCH, DELETE } from "./route";
import { getProjectByIndex } from "@/lib/projects";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;

function makeCtx(id: string, taskId: string) {
  return { params: Promise.resolve({ id, taskId }) };
}

function makeReq(method: string, id: string, taskId: string, body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3200/api/projects/${id}/tasks/${taskId}`,
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

const SAMPLE_BACKLOG = `# Tasks

## CEO Requests

### T001: First item
- **Priority:** P1
- **Details:**
  - some detail

### T002: Second item
- **Priority:** P2
- **Details:**
  - another detail

## Done
`;

describe("GET /api/projects/[id]/tasks/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "99", "T001"), makeCtx("99", "T001"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([{ id: "T001", title: "x", priority: "P1" }]);
    mockReadState.mockResolvedValue(null);
    const res = await GET(makeReq("GET", "0", "T999"), makeCtx("0", "T999"));
    expect(res.status).toBe(404);
  });

  it("returns 200 with basic item when cost data absent", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([
      { id: "T001", title: "First", priority: "P1" },
    ]);
    mockReadState.mockResolvedValue({ item_costs: {} });
    const res = await GET(makeReq("GET", "0", "T001"), makeCtx("0", "T001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("T001");
    expect(json.data.title).toBe("First");
    expect(json.data.cost_usd).toBeUndefined();
  });

  it("returns 200 with cost_usd enrichment when state has cost", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([
      { id: "T001", title: "First", priority: "P1" },
    ]);
    mockReadState.mockResolvedValue({ item_costs: { "T001": 1.23 } });
    const res = await GET(makeReq("GET", "0", "T001"), makeCtx("0", "T001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.cost_usd).toBe(1.23);
  });
});

describe("PATCH /api/projects/[id]/tasks/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(SAMPLE_BACKLOG);
    mockWriteFile.mockResolvedValue(undefined);
    mockAtomicWrite.mockResolvedValue(undefined);
    mockReadState.mockResolvedValue(null);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await PATCH(
      makeReq("PATCH", "99", "T001", { title: "new" }),
      makeCtx("99", "T001")
    );
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates title on valid title update", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([
      { id: "T001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "T001", { title: "Updated title" }),
      makeCtx("0", "T001")
    );
    expect(res.status).toBe(200);
    expect(mockAtomicWrite).toHaveBeenCalledTimes(1);
    const [, written] = mockAtomicWrite.mock.calls[0];
    expect(written).toContain("### T001: Updated title");
  });

  it("returns 200 and updates priority on valid priority update", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([
      { id: "T001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "T001", { priority: "P3" }),
      makeCtx("0", "T001")
    );
    expect(res.status).toBe(200);
    const [, written] = mockAtomicWrite.mock.calls[0];
    expect(written).toMatch(/### T001:[^\n]*\n- \*\*Priority:\*\* P3/);
  });

  it("returns 404 when tasks file is missing (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const res = await PATCH(
      makeReq("PATCH", "0", "T001", { title: "x" }),
      makeCtx("0", "T001")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when task not found", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    mockReadTasks.mockResolvedValue([
      { id: "T001", title: "First item", priority: "P1" },
    ]);
    const res = await PATCH(
      makeReq("PATCH", "0", "T999", { title: "x" }),
      makeCtx("0", "T999")
    );
    expect(res.status).toBe(404);
  });

  // T122 — Description field update tests
  describe("description field updates (T122)", () => {
    const BACKLOG_WITH_DESCRIPTION = `# Tasks

## CEO Requests

### T001: First item
- **Priority:** P1
- **Description:** original description text
- **Details:**
  - some detail

### T002: Second item
- **Priority:** P2
- **Description:** other description
`;

    const BACKLOG_WITHOUT_DESCRIPTION = `# Tasks

## CEO Requests

### T001: First item
- **Priority:** P1
- **Details:**
  - some detail

### T002: Second item
- **Priority:** P2
`;

    const BACKLOG_MULTILINE_DESCRIPTION = `# Tasks

## CEO Requests

### T001: First item
- **Priority:** P1
- **Description:** first paragraph

  second paragraph continues here
- **Details:**
  - some detail

### T002: Second item
- **Priority:** P2
`;

    it("updates an existing - **Description:** line", async () => {
      mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
      mockReadFile.mockResolvedValue(BACKLOG_WITH_DESCRIPTION);
      mockReadTasks.mockResolvedValue([
        { id: "T001", title: "First item", priority: "P1" },
      ]);
      const res = await PATCH(
        makeReq("PATCH", "0", "T001", { description: "updated description" }),
        makeCtx("0", "T001")
      );
      expect(res.status).toBe(200);
      expect(mockAtomicWrite).toHaveBeenCalledTimes(1);
      const [, written] = mockAtomicWrite.mock.calls[0];
      expect(written).toContain("- **Description:** updated description");
      expect(written).not.toContain("original description text");
      // Must not affect T002's description
      expect(written).toContain("- **Description:** other description");
    });

    it("inserts - **Description:** when no existing field", async () => {
      mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
      mockReadFile.mockResolvedValue(BACKLOG_WITHOUT_DESCRIPTION);
      mockReadTasks.mockResolvedValue([
        { id: "T001", title: "First item", priority: "P1" },
      ]);
      const res = await PATCH(
        makeReq("PATCH", "0", "T001", { description: "new description text" }),
        makeCtx("0", "T001")
      );
      expect(res.status).toBe(200);
      const [, written] = mockAtomicWrite.mock.calls[0];
      expect(written).toContain("- **Description:** new description text");
      // The block must still contain its original Priority and Details fields
      expect(written).toMatch(
        /### T001: First item\n[\s\S]*- \*\*Priority:\*\* P1/
      );
      expect(written).toContain("- **Details:**");
    });

    it("replaces multi-line description value with single-line value", async () => {
      mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
      mockReadFile.mockResolvedValue(BACKLOG_MULTILINE_DESCRIPTION);
      mockReadTasks.mockResolvedValue([
        { id: "T001", title: "First item", priority: "P1" },
      ]);
      const res = await PATCH(
        makeReq("PATCH", "0", "T001", { description: "compact replacement" }),
        makeCtx("0", "T001")
      );
      expect(res.status).toBe(200);
      const [, written] = mockAtomicWrite.mock.calls[0];
      expect(written).toContain("- **Description:** compact replacement");
      expect(written).not.toContain("first paragraph");
      expect(written).not.toContain("second paragraph continues here");
      // Details section must remain intact
      expect(written).toContain("- **Details:**");
    });

    it("removes description line when description is empty string", async () => {
      mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
      mockReadFile.mockResolvedValue(BACKLOG_WITH_DESCRIPTION);
      mockReadTasks.mockResolvedValue([
        { id: "T001", title: "First item", priority: "P1" },
      ]);
      const res = await PATCH(
        makeReq("PATCH", "0", "T001", { description: "" }),
        makeCtx("0", "T001")
      );
      expect(res.status).toBe(200);
      const [, written] = mockAtomicWrite.mock.calls[0];
      // T001 should no longer have a Description line
      const t001Block = written.match(
        /### T001:[\s\S]*?(?=### |$)/
      )?.[0] ?? "";
      expect(t001Block).not.toContain("- **Description:**");
      // T002 untouched
      expect(written).toContain("### T002: Second item");
      expect(written).toContain("- **Description:** other description");
    });

    it("still updates details when both details and description are provided", async () => {
      mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
      mockReadFile.mockResolvedValue(BACKLOG_WITH_DESCRIPTION);
      mockReadTasks.mockResolvedValue([
        { id: "T001", title: "First item", priority: "P1" },
      ]);
      const res = await PATCH(
        makeReq("PATCH", "0", "T001", {
          description: "new description",
          details: "  - new bullet",
        }),
        makeCtx("0", "T001")
      );
      expect(res.status).toBe(200);
      const [, written] = mockAtomicWrite.mock.calls[0];
      expect(written).toContain("- **Description:** new description");
      expect(written).toContain("- new bullet");
    });
  });
});

describe("DELETE /api/projects/[id]/tasks/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(SAMPLE_BACKLOG);
    mockWriteFile.mockResolvedValue(undefined);
    mockAtomicWrite.mockResolvedValue(undefined);
  });

  it("returns 404 when project not found", async () => {
    mockGetProject.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE", "99", "T001"), makeCtx("99", "T001"));
    expect(res.status).toBe(404);
  });

  it("returns 200 and writes updated tasks file without the item", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const res = await DELETE(makeReq("DELETE", "0", "T001"), makeCtx("0", "T001"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(mockAtomicWrite).toHaveBeenCalledTimes(1);
    const [, written] = mockAtomicWrite.mock.calls[0];
    expect(written).not.toContain("### T001:");
    expect(written).toContain("### T002:");
  });

  it("returns 404 when tasks file is missing (ENOENT)", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);
    const res = await DELETE(makeReq("DELETE", "0", "T001"), makeCtx("0", "T001"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when item not found in content", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    const res = await DELETE(makeReq("DELETE", "0", "T999"), makeCtx("0", "T999"));
    expect(res.status).toBe(404);
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("GET returns 400 for non-numeric id", async () => {
    const res = await GET(makeReq("GET", "abc", "T1"), makeCtx("abc", "T1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });

  it("PATCH returns 400 for non-numeric id", async () => {
    const res = await PATCH(makeReq("PATCH", "abc", "T1", { title: "x" }), makeCtx("abc", "T1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });

  it("DELETE returns 400 for non-numeric id", async () => {
    const res = await DELETE(makeReq("DELETE", "abc", "T1"), makeCtx("abc", "T1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
