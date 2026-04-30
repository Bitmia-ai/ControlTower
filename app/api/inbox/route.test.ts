import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/lib/redeye-files", () => ({
  readInbox: vi.fn(),
}));

import { GET } from "./route";
import { listProjects } from "@/lib/projects";
import { readInbox } from "@/lib/redeye-files";

const mockList = listProjects as ReturnType<typeof vi.fn>;
const mockInbox = readInbox as ReturnType<typeof vi.fn>;

describe("GET /api/inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no projects", async () => {
    mockList.mockResolvedValue([]);
    const res = await GET();
    const json = await res.json();
    expect(json.data).toEqual([]);
  });

  it("aggregates unanswered questions across projects with stable uids", async () => {
    mockList.mockResolvedValue([
      { name: "haze", path: "/p/haze" },
      { name: "redeye", path: "/p/redeye" },
    ]);
    mockInbox.mockImplementation(async (path: string) => {
      if (path === "/p/haze") {
        return [
          { id: "Q-1", question: "Retry?", answered: false },
          { id: "Q-2", question: "Drop legacy?", answered: true },
        ];
      }
      return [{ id: "Q-9", question: "Use pino?", answered: false }];
    });

    const res = await GET();
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    const uids = json.data.map((x: { uid: string }) => x.uid).sort();
    expect(uids).toEqual(["0:Q-1", "1:Q-9"]);
  });

  it("survives readInbox failures (e.g. uninitialized project)", async () => {
    mockList.mockResolvedValue([
      { name: "broken", path: "/p/broken" },
      { name: "ok", path: "/p/ok" },
    ]);
    mockInbox.mockImplementation(async (path: string) => {
      if (path === "/p/broken") throw new Error("ENOENT");
      return [{ id: "Q-3", question: "x", answered: false }];
    });
    const res = await GET();
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].uid).toBe("1:Q-3");
  });
});
