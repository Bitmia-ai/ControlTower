import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
  },
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
}));
// NOTE: atomicWriteJson is intentionally NOT mocked here — the test
// exercises the real atomic-write path (writeFile(tmp) + rename(tmp,target))
// because the concurrent-decrement test asserts on rename ordering.


// Stub the git commit helper so tests don't shell out to git.
vi.mock("@/lib/git-commit-push", () => ({
  commitAndPush: vi.fn(async () => ({ committed: true })),
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import * as fsPromises from "fs/promises";
import * as logger from "@/lib/logger";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
// fs/promises mocked — access through default export
const fsMock = fsPromises as unknown as {
  default: {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
  };
  readFile: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  rename: ReturnType<typeof vi.fn>;
  unlink: ReturnType<typeof vi.fn>;
};

function getReadFile() {
  return fsMock.default?.readFile ?? fsMock.readFile;
}
function getWriteFile() {
  return fsMock.default?.writeFile ?? fsMock.writeFile;
}
function getRename() {
  return fsMock.default?.rename ?? fsMock.rename;
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

    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

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

  it("serializes 10 concurrent /answer calls without losing health-counter decrements", async () => {
    // Regression for T149: without withProjectLock, two concurrent answers
    // would each read the same counter and each write `counter - 1`,
    // leaking one decrement. With the mutex, 10 concurrent calls must
    // result in `start - 10`.
    mockGetProject.mockResolvedValue({ name: "t", path: "/concurrent-project" });

    const STARTING_QUESTIONS = 10;
    // Simulate the on-disk inbox containing 10 distinct open questions.
    let inboxContent = "## Questions (Open)\n\n";
    for (let i = 1; i <= STARTING_QUESTIONS; i += 1) {
      const id = `Q-${String(i).padStart(3, "0")}`;
      inboxContent += `### ${id}: q${i}\n- **Priority:** P1\n\n`;
    }
    inboxContent += "## Answered / Provided\n";

    // The state object is the shared mutable "disk" view; readFile returns
    // a JSON snapshot of its current value, atomicWriteJson (via rename)
    // commits a parsed new value back into it.
    const diskState: { health: { questions_awaiting_ceo: number } } = {
      health: { questions_awaiting_ceo: STARTING_QUESTIONS },
    };
    // tmpPath -> pending content, written by writeFile and committed on rename.
    const pendingTempWrites = new Map<string, string>();

    const readFile = getReadFile();
    const writeFile = getWriteFile();
    const rename = getRename();

    readFile.mockImplementation(async (p: string) => {
      if (p.endsWith("inbox.md")) return inboxContent;
      if (p.endsWith("state.json")) return JSON.stringify(diskState);
      throw new Error("unexpected read: " + p);
    });
    writeFile.mockImplementation(async (p: string, content: string) => {
      // The atomic-write path goes through writeFile(tmp) + rename(tmp,target).
      // Inbox is written via fs.writeFile(inboxPath, content) directly
      // (no tmp), so we ignore that path for the state assertion.
      if (p.includes("state.json.tmp.")) {
        pendingTempWrites.set(p, content);
        return;
      }
      if (p.endsWith("inbox.md")) {
        inboxContent = content;
        return;
      }
    });
    rename.mockImplementation(async (src: string, dst: string) => {
      if (dst.endsWith("state.json")) {
        const content = pendingTempWrites.get(src);
        pendingTempWrites.delete(src);
        if (content !== undefined) {
          const parsed = JSON.parse(content);
          diskState.health = parsed.health;
        }
      }
    });

    // Fire 10 concurrent /answer calls, each targeting a distinct question.
    const calls: Promise<unknown>[] = [];
    for (let i = 1; i <= STARTING_QUESTIONS; i += 1) {
      const id = `Q-${String(i).padStart(3, "0")}`;
      const [req, ctx] = makeRequest("0", { questionId: id, answer: `a${i}` });
      calls.push(POST(req, ctx));
    }
    const results = await Promise.all(calls);

    // Every request returns 200.
    for (const r of results) {
      expect((r as Response).status).toBe(200);
    }
    // Crucially: no decrements were lost.
    expect(diskState.health.questions_awaiting_ceo).toBe(0);
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc", { questionId: "Q-1", answer: "x" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
