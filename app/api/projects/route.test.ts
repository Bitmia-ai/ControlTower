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
}));

vi.mock("@/lib/session-manager", () => ({
  getSessionStatus: vi.fn(),
}));

import { GET } from "./route";
import { listProjects } from "@/lib/projects";
import { isInitialized, readState } from "@/lib/redeye-files";
import { getSessionStatus } from "@/lib/session-manager";

const mockListProjects = listProjects as ReturnType<typeof vi.fn>;
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
