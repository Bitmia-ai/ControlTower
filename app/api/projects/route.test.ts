import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the route
vi.mock("@/lib/projects", () => ({
  listProjects: vi.fn(),
  addProject: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  isInitialized: vi.fn(),
  readState: vi.fn(),
  readInbox: vi.fn().mockResolvedValue([]),
  readTasks: vi.fn().mockResolvedValue([]),
  readArchivedTasks: vi.fn().mockResolvedValue([]),
  // safeRedeyePath returns a deterministic path for tests; the real impl
  // resolves to projectPath/.redeye/<filename> with traversal guards.
  safeRedeyePath: (projectPath: string, filename: string) =>
    `${projectPath}/.redeye/${filename}`,
}));

vi.mock("fs/promises", () => ({
  default: {
    // schedules.md absent in test fixtures — readScheduleSummary swallows ENOENT.
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  },
}));

vi.mock("@/lib/redeye-parsers", () => ({
  parseSchedules: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
}));

import { GET, POST } from "./route";
import { listProjects, addProject } from "@/lib/projects";
import { isInitialized, readState } from "@/lib/redeye-files";
import { getSessionStatus } from "@/lib/session-manager";

const mockListProjects = listProjects as ReturnType<typeof vi.fn>;
const mockAddProject = addProject as ReturnType<typeof vi.fn>;
const mockIsInitialized = isInitialized as ReturnType<typeof vi.fn>;
const mockReadState = readState as ReturnType<typeof vi.fn>;
const mockGetSessionStatus = getSessionStatus as ReturnType<typeof vi.fn>;

function stoppedSession() {
  return { cto: { status: "stopped" } };
}

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no projects", async () => {
    mockListProjects.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("includes phase and currentTask when state.json has active task", async () => {
    mockListProjects.mockResolvedValue([{ name: "haze", path: "/projects/haze" }]);
    mockIsInitialized.mockResolvedValue(true);
    mockReadState.mockResolvedValue({
      phase: "BUILD",
      task_id: "T018",
      task_title: "Home status fix",
    });
    mockGetSessionStatus.mockReturnValue(stoppedSession());

    const res = await GET();
    const json = await res.json();
    const project = json.data[0];

    expect(project.phase).toBe("BUILD");
    expect(project.currentTask).toBe("T018 Home status fix");
  });

  it("sets currentTask to null when task_title is missing", async () => {
    mockListProjects.mockResolvedValue([{ name: "haze", path: "/projects/haze" }]);
    mockIsInitialized.mockResolvedValue(true);
    mockReadState.mockResolvedValue({ phase: "TRIAGE", task_id: null, task_title: null });
    mockGetSessionStatus.mockReturnValue(stoppedSession());

    const res = await GET();
    const json = await res.json();
    const project = json.data[0];

    expect(project.phase).toBe("TRIAGE");
    expect(project.currentTask).toBeNull();
  });

  it("sets phase to undefined and currentTask to null when state.json is absent", async () => {
    mockListProjects.mockResolvedValue([{ name: "haze", path: "/projects/haze" }]);
    mockIsInitialized.mockResolvedValue(false);
    mockReadState.mockResolvedValue(null);
    mockGetSessionStatus.mockReturnValue(stoppedSession());

    const res = await GET();
    const json = await res.json();
    const project = json.data[0];

    expect(project.phase).toBeUndefined();
    expect(project.currentTask).toBeNull();
  });

  it("preserves initialized and running fields", async () => {
    mockListProjects.mockResolvedValue([{ name: "haze", path: "/projects/haze" }]);
    mockIsInitialized.mockResolvedValue(true);
    mockReadState.mockResolvedValue({ phase: "DEPLOY", task_id: null, task_title: null });
    mockGetSessionStatus.mockReturnValue({ cto: { status: "running" } });

    const res = await GET();
    const json = await res.json();
    const project = json.data[0];

    expect(project.initialized).toBe(true);
    expect(project.running).toBe(true);
  });

  it("trims currentTask when task_id is null", async () => {
    mockListProjects.mockResolvedValue([{ name: "haze", path: "/projects/haze" }]);
    mockIsInitialized.mockResolvedValue(true);
    mockReadState.mockResolvedValue({
      phase: "PLAN",
      task_id: null,
      task_title: "Some task title",
    });
    mockGetSessionStatus.mockReturnValue(stoppedSession());

    const res = await GET();
    const json = await res.json();
    const project = json.data[0];

    // No leading space when task_id is null
    expect(project.currentTask).toBe("Some task title");
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePost(body: string, contentType?: string): Request {
    const headers: Record<string, string> = {};
    if (contentType !== undefined) headers["content-type"] = contentType;
    return new Request("http://localhost/api/projects", {
      method: "POST",
      headers,
      body,
    });
  }

  it("rejects requests missing application/json content-type with 415", async () => {
    const req = makePost(JSON.stringify({ name: "x", path: "/p" }), "text/plain");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(415);
  });

  it("returns 400 when name or path missing", async () => {
    const req = makePost(JSON.stringify({ name: "x" }), "application/json");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("registers a valid project and returns 201", async () => {
    mockAddProject.mockResolvedValue({ name: "ct", path: "/Users/x/ct" });
    const req = makePost(
      JSON.stringify({ name: "ct", path: "/Users/x/ct" }),
      "application/json"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual({ name: "ct", path: "/Users/x/ct" });
  });
});
