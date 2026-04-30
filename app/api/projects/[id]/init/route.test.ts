import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { EventEmitter } from "events";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

const { mockSpawnFn } = vi.hoisted(() => ({ mockSpawnFn: vi.fn() }));
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    default: { ...actual, spawn: mockSpawnFn },
    spawn: mockSpawnFn,
  };
});

vi.mock("@/lib/json-body", () => ({
  readJsonBody: vi.fn(),
}));

vi.mock("@/lib/claude-runner", () => ({
  REDEYE_PLUGIN_DIR: "/mock/plugin",
}));

import { POST } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { readJsonBody } from "@/lib/json-body";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockSpawn = mockSpawnFn;
const mockReadJsonBody = readJsonBody as unknown as ReturnType<typeof vi.fn>;

const PROJECT = { name: "haze", path: "/tmp/haze" };

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/init`, {
    method: "POST",
    body: "{}",
    headers: { "content-type": "application/json" },
  });
  return [req, { params: Promise.resolve({ id }) }];
}

/**
 * Build a fake child_process result that emits stdout/stderr and closes with
 * the given exit code on the next tick. Used for happy-path and spawn-failure
 * tests.
 */
function fakeProc(opts: { stdout?: string; stderr?: string; code?: number }) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  process.nextTick(() => {
    if (opts.stdout !== undefined) proc.stdout.emit("data", opts.stdout);
    if (opts.stderr !== undefined) proc.stderr.emit("data", opts.stderr);
    proc.emit("close", opts.code ?? 0);
  });
  return proc;
}

const FORBIDDEN_CHARS: ReadonlyArray<readonly [string, string]> = [
  ["NUL", "\x00"],
  ["SOH", "\x01"],
  ["VT", "\x0B"],
  ["CR", "\r"],
  ["LF", "\n"],
  ["TAB", "\t"],
  ["backtick", "`"],
  ["dollar", "$"],
  ["backslash", "\\"],
];

describe("POST /api/projects/[id]/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProject.mockResolvedValue(PROJECT);
  });

  it("returns 404 when project is missing", async () => {
    mockGetProject.mockResolvedValue(null);
    mockReadJsonBody.mockResolvedValue({ ok: true, data: {} });
    const [req, ctx] = makeRequest("99");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  for (const [name, ch] of FORBIDDEN_CHARS) {
    it(`returns 400 when vision contains forbidden ${name} character`, async () => {
      mockReadJsonBody.mockResolvedValue({
        ok: true,
        data: { vision: `bad${ch}value` },
      });
      const [req, ctx] = makeRequest("0");
      const res = await POST(req, ctx);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/forbidden characters/i);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  }

  it("returns 400 when a field exceeds MAX_FIELD_LEN (4096 chars)", async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      data: { vision: "a".repeat(4097) },
    });
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too long/i);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("returns 400 when a field is not a string", async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      data: { vision: 42 },
    });
    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/must be a string/i);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("happy-path: passes all 5 fields, spawn exits 0 with Done! marker", async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      data: {
        vision: "polish dashboard",
        firstTask: "fix bug",
        deployCommand: "npm run build",
        testCommand: "npx vitest run",
        appUrl: "http://localhost:3200",
      },
    });
    mockSpawn.mockImplementationOnce(() =>
      fakeProc({ stdout: "Done!", code: 0 })
    );

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(json.data.output).toContain("Done!");

    // Spawn was called once; verify env vars contain the validated fields.
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: NodeJS.ProcessEnv; cwd: string }
    ];
    expect(cmd).toBe("bash");
    expect(args[0]).toMatch(/init-project\.sh$/);
    expect(args[1]).toBe(PROJECT.path);
    expect(opts.cwd).toBe(PROJECT.path);
    expect(opts.env.PROJECT_NAME).toBe(PROJECT.name);
    expect(opts.env.VISION_TEXT).toBe("polish dashboard");
    expect(opts.env.FIRST_TASK).toBe("fix bug");
    expect(opts.env.DEPLOY_COMMAND).toBe("npm run build");
    expect(opts.env.TEST_COMMAND).toBe("npx vitest run");
    expect(opts.env.APP_URL).toBe("http://localhost:3200");
  });

  it("returns 500 when spawn exits non-zero without Done! marker", async () => {
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      data: { vision: "polish dashboard" },
    });
    mockSpawn.mockImplementationOnce(() =>
      fakeProc({ stdout: "", stderr: "boom", code: 1 })
    );

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/init-project\.sh failed/i);
    expect(json.error).toMatch(/boom/);
  });

  it("treats non-zero exit as success when stdout contains Done!", async () => {
    // The route allows non-zero exit if stdout has Created:/Done! markers
    // (git pre-commit hook may fail but .redeye/ files were still written).
    mockReadJsonBody.mockResolvedValue({
      ok: true,
      data: { vision: "polish dashboard" },
    });
    mockSpawn.mockImplementationOnce(() =>
      fakeProc({ stdout: "Done! despite hook failure", code: 1 })
    );

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
  });

  it("propagates the readJsonBody error response (415, 413, etc) without spawning", async () => {
    // readJsonBody returns its own NextResponse for content-type / size issues.
    const errorResponse = Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
    mockReadJsonBody.mockResolvedValue({ ok: false, response: errorResponse });

    const [req, ctx] = makeRequest("0");
    const res = await POST(req, ctx);
    expect(res.status).toBe(415);
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeRequest("abc");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
