import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  readChangelog: vi.fn(),
}));

import { GET } from "./route";
import { listProjects } from "@/lib/projects";
import { readChangelog } from "@/lib/redeye-files";

const mockList = listProjects as ReturnType<typeof vi.fn>;
const mockChangelog = readChangelog as ReturnType<typeof vi.fn>;

describe("GET /api/activity", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no projects", async () => {
    mockList.mockResolvedValue([]);
    const res = await GET();
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("aggregates and sorts entries newest-first across projects", async () => {
    mockList.mockResolvedValue([
      { name: "haze", path: "/p/haze" },
      { name: "redeye", path: "/p/redeye" },
    ]);
    mockChangelog.mockImplementation(async (path: string) => {
      if (path === "/p/haze") {
        return [
          { title: "Old haze entry", details: "x", date: "2026-04-25" },
          { title: "New haze entry", details: "y", date: "2026-04-28" },
        ];
      }
      return [{ title: "Redeye recent", details: "z", date: "2026-04-29" }];
    });

    const res = await GET();
    const json = await res.json();
    const titles = json.data.map((e: { title: string }) => e.title);
    expect(titles).toEqual([
      "Redeye recent",
      "New haze entry",
      "Old haze entry",
    ]);
  });

  it("survives changelog read failures", async () => {
    mockList.mockResolvedValue([
      { name: "broken", path: "/p/broken" },
      { name: "ok", path: "/p/ok" },
    ]);
    mockChangelog.mockImplementation(async (path: string) => {
      if (path === "/p/broken") throw new Error("ENOENT");
      return [{ title: "Survives", details: "", date: "2026-04-29" }];
    });
    const res = await GET();
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].title).toBe("Survives");
  });
});
