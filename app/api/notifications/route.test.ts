/**
 * GET /api/notifications — unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/lib/notification-store", () => ({
  getNotificationsSince: vi.fn(),
}));

import { GET } from "./route";
import { listProjects } from "@/lib/projects";
import { getNotificationsSince } from "@/lib/notification-store";

const mockListProjects = listProjects as ReturnType<typeof vi.fn>;
const mockGetSince = getNotificationsSince as ReturnType<typeof vi.fn>;

function makeReq(url = "http://localhost:3200/api/notifications"): Request {
  return new Request(url);
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no projects", async () => {
    mockListProjects.mockResolvedValue([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.notifications).toEqual([]);
  });

  it("merges notifications from multiple projects, newest first", async () => {
    mockListProjects.mockResolvedValue([
      { name: "alpha", path: "/a" },
      { name: "beta", path: "/b" },
    ]);
    mockGetSince.mockImplementation((path: string, idx: number, name: string) => {
      if (path === "/a") return Promise.resolve([
        { id: "1", type: "task-complete", projectId: idx, projectName: name, message: "alpha-old", timestamp: "2026-04-27T00:00:00.000Z", taskId: null },
      ]);
      return Promise.resolve([
        { id: "2", type: "task-complete", projectId: idx, projectName: name, message: "beta-new", timestamp: "2026-04-27T01:00:00.000Z", taskId: null },
      ]);
    });

    const res = await GET(makeReq());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.notifications.map((n: { id: string }) => n.id)).toEqual(["2", "1"]);
  });

  it("passes parsed since (epoch ms) into getNotificationsSince", async () => {
    mockListProjects.mockResolvedValue([{ name: "p", path: "/p" }]);
    mockGetSince.mockResolvedValue([]);
    await GET(makeReq("http://localhost:3200/api/notifications?since=1700000000000"));
    expect(mockGetSince).toHaveBeenCalledWith("/p", 0, "p", 1700000000000);
  });

  it("falls back to 0 when since is malformed", async () => {
    mockListProjects.mockResolvedValue([{ name: "p", path: "/p" }]);
    mockGetSince.mockResolvedValue([]);
    await GET(makeReq("http://localhost:3200/api/notifications?since=not-a-number"));
    expect(mockGetSince).toHaveBeenCalledWith("/p", 0, "p", 0);
  });

  it("accepts ISO 8601 since values", async () => {
    mockListProjects.mockResolvedValue([{ name: "p", path: "/p" }]);
    mockGetSince.mockResolvedValue([]);
    const iso = "2026-04-27T00:00:00.000Z";
    await GET(makeReq(`http://localhost:3200/api/notifications?since=${encodeURIComponent(iso)}`));
    expect(mockGetSince).toHaveBeenCalledWith("/p", 0, "p", new Date(iso).getTime());
  });

  it("returns 500 on store error", async () => {
    mockListProjects.mockResolvedValue([{ name: "p", path: "/p" }]);
    mockGetSince.mockRejectedValue(new Error("boom"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeTypeOf("string");
  });
});
