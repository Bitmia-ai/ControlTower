import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import * as fsPromises from "fs/promises";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
// fs/promises mocked — access through default export
const fsMock = fsPromises as unknown as {
  default: {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
  };
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
};

function getReadFile() {
  return fsMock.default?.readFile ?? fsMock.readFile;
}
function getWriteFile() {
  return fsMock.default?.writeFile ?? fsMock.writeFile;
}

function makeRequest(id: string, body: unknown): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/answer`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return [req, { params: Promise.resolve({ id }) }];
}

const INBOX = `## Questions (Open)

### Q-001: test
- **Priority:** P1

## Answered / Provided
`;

const STATE = JSON.stringify({
  health: { questions_awaiting_ceo: 2 },
});

describe("POST /api/projects/[id]/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and state.json write failure is logged but does not fail request", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });

    const readFile = getReadFile();
    const writeFile = getWriteFile();
    readFile.mockImplementation(async (p: string) => {
      if (p.endsWith("inbox.md")) return INBOX;
      if (p.endsWith("state.json")) return STATE;
      throw new Error("unexpected read: " + p);
    });

    // First writeFile call = inbox.md (succeeds).  Second = state.json (fails).
    writeFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("state write failed"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const [req, ctx] = makeRequest("0", { questionId: "Q-001", answer: "yes" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns 500 when inbox.md read fails", async () => {
    mockGetProject.mockResolvedValue({ name: "t", path: "/t" });
    getReadFile().mockRejectedValue(new Error("inbox read failed"));

    const [req, ctx] = makeRequest("0", { questionId: "Q-001", answer: "yes" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
