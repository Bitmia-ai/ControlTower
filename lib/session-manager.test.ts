// @vitest-environment node
/**
 * Unit tests for session-manager.ts stall detection logic (T010 T6).
 *
 * Tests cover makeSessionInfo returning:
 *  1. "running"  — fresh transcript mtime, process alive
 *  2. "stalled"  — stale transcript mtime (>10 min), process alive
 *  3. "stopped"  — no process
 *  4. lastActivity: null — no transcript file, status not stalled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  mockStatSync,
  mockWriteFileSync,
  mockReadFileSync,
  mockUnlinkSync,
  mockProcessKill,
  mockResolveTranscriptFile,
  mockExecFileSync,
} = vi.hoisted(() => ({
  mockStatSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockProcessKill: vi.fn(),
  mockResolveTranscriptFile: vi.fn(),
  mockExecFileSync: vi.fn(),
}));

vi.mock(import("fs"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    statSync: mockStatSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
  };
});

vi.mock(import("./transcript-file-resolver"), () => ({
  resolveTranscriptFile: mockResolveTranscriptFile,
}));

// Mock child_process so pidCwd() returns the test project path for LIVE_PID,
// preventing the CWD-verification step from discarding the discovered PID.
vi.mock(import("child_process"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execFileSync: mockExecFileSync,
  };
});

// We need to mock process.kill for isProcessRunning; use vi.spyOn after import.
// Also mock spawnClaudeSession so we don't actually spawn.
vi.mock(import("./claude-runner"), () => ({
  spawnClaudeSession: vi.fn(() => ({ pid: 9999, logFile: "/tmp/test.jsonl" })),
  runClaudeCommand: vi.fn(),
}));

import { getSessionStatus } from "./session-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_PATH = "/tmp/test-project";
const STALE_MTIME = Date.now() - 11 * 60 * 1000; // 11 minutes ago
const FRESH_MTIME = Date.now() - 30 * 1000; // 30 seconds ago
const LIVE_PID = 12345;

function setupProcessKill(alivePids: Set<number>) {
  vi.spyOn(process, "kill").mockImplementation((pid: number, signal?: string | number) => {
    if (signal === 0 || signal === undefined) {
      if (alivePids.has(pid)) return true;
      const err: NodeJS.ErrnoException = new Error("ESRCH");
      err.code = "ESRCH";
      throw err;
    }
    return true;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no PID file
  mockReadFileSync.mockImplementation(() => {
    const err: NodeJS.ErrnoException = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });
  // Default: no session log file (so discoverPid won't return -1)
  mockStatSync.mockImplementation(() => {
    const err: NodeJS.ErrnoException = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });
  mockResolveTranscriptFile.mockReturnValue(null);
  // Default: lsof returns the project path for LIVE_PID so pidCwd() passes.
  // The "n" prefix tells pidCwd() this is the cwd line (lsof -Fn output format).
  mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
    if (cmd === "lsof" && args.includes(String(LIVE_PID))) {
      return `p${LIVE_PID}\ncwd\nn${PROJECT_PATH}\n`;
    }
    // ps calls (findOrphanCtoPid) — return empty so no orphan is found
    return "";
  });
});

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe("getSessionStatus / makeSessionInfo — stall detection", () => {
  it("1. returns status:'running' when transcript mtime is fresh and process alive", () => {
    // Arrange: live PID in pid file, fresh transcript
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes("session-cto.pid")) return String(LIVE_PID);
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });
    mockStatSync.mockImplementation((filePath: string) => {
      // Used for: transcript resolver, session log staleness check
      return { mtimeMs: FRESH_MTIME, isDirectory: () => false };
    });
    mockResolveTranscriptFile.mockReturnValue("/tmp/fresh-transcript.jsonl");
    setupProcessKill(new Set([LIVE_PID]));

    const status = getSessionStatus(PROJECT_PATH);

    expect(status.cto.status).toBe("running");
    expect(status.cto.lastActivity).toBe(FRESH_MTIME);
  });

  it("2. returns status:'stalled' when transcript mtime is >10 min old and process alive", () => {
    // Arrange: live PID, stale transcript
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes("session-cto.pid")) return String(LIVE_PID);
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });
    mockStatSync.mockImplementation((_filePath: string) => {
      return { mtimeMs: STALE_MTIME, isDirectory: () => false };
    });
    mockResolveTranscriptFile.mockReturnValue("/tmp/stale-transcript.jsonl");
    setupProcessKill(new Set([LIVE_PID]));

    const status = getSessionStatus(PROJECT_PATH);

    expect(status.cto.status).toBe("stalled");
    expect(status.cto.lastActivity).toBe(STALE_MTIME);
  });

  it("3. returns status:'stopped' when no process is running", () => {
    // Arrange: no PID file, no alive process
    setupProcessKill(new Set()); // no alive PIDs
    mockResolveTranscriptFile.mockReturnValue(null);

    const status = getSessionStatus(PROJECT_PATH);

    expect(status.cto.status).toBe("stopped");
    expect(status.cto.pid).toBeNull();
  });

  it("4. returns lastActivity:null and status not stalled when no transcript file exists", () => {
    // Arrange: live PID, but no transcript file
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes("session-cto.pid")) return String(LIVE_PID);
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });
    // statSync called for transcript returns ENOENT
    mockStatSync.mockImplementation((filePath: string) => {
      if (String(filePath).includes("session-cto.jsonl")) {
        // session log file — return stale so discoverPid doesn't use -1 path
        // Actually we need it to throw to simulate no log file
        const err: NodeJS.ErrnoException = new Error("ENOENT");
        err.code = "ENOENT";
        throw err;
      }
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });
    mockResolveTranscriptFile.mockReturnValue(null); // no transcript
    setupProcessKill(new Set([LIVE_PID]));

    const status = getSessionStatus(PROJECT_PATH);

    // No transcript → lastActivity null → cannot be stalled
    expect(status.cto.lastActivity).toBeNull();
    expect(status.cto.status).not.toBe("stalled");
    // Process is alive → should be running
    expect(status.cto.status).toBe("running");
  });
});

describe("restoreAutoRestartFromDisk — config path resolution", () => {
  let savedHome: string | undefined;
  let savedConfigPath: string | undefined;

  beforeEach(() => {
    savedHome = process.env.HOME;
    savedConfigPath = process.env.REDEYE_CONFIG_PATH;
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedConfigPath === undefined) delete process.env.REDEYE_CONFIG_PATH;
    else process.env.REDEYE_CONFIG_PATH = savedConfigPath;
    vi.resetModules();
  });

  it("uses os.homedir() to build config path when HOME is unset", async () => {
    delete process.env.HOME;
    delete process.env.REDEYE_CONFIG_PATH;

    // Reset modules so the imported session-manager module re-evaluates with
    // the cleared env vars and a fresh restoreCompleted flag.
    vi.resetModules();

    // Track every readFileSync call so we can assert the config path used.
    const readCalls: string[] = [];
    const readFileSyncSpy = vi.fn((filePath: string) => {
      readCalls.push(String(filePath));
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    vi.doMock("fs", async (importOriginal: () => Promise<typeof import("fs")>) => {
      const actual = await importOriginal();
      return {
        ...actual,
        readFileSync: readFileSyncSpy,
        statSync: vi.fn(() => {
          const err: NodeJS.ErrnoException = new Error("ENOENT");
          err.code = "ENOENT";
          throw err;
        }),
      };
    });

    const mod = await import("./session-manager.js");
    mod.ensureAutoRestartRestored();

    const configReadCall = readCalls.find((p) => p.endsWith(path.join(".redeye", "config.json")));
    expect(configReadCall, `expected a readFileSync call for .redeye/config.json. Calls: ${readCalls.join(", ")}`).toBeDefined();
    expect(configReadCall!.startsWith(os.homedir())).toBe(true);
    expect(configReadCall!.startsWith("/root")).toBe(false);
    expect(configReadCall!).not.toMatch(/(^|\/)~\//);

    vi.doUnmock("fs");
  });

  it("uses REDEYE_CONFIG_PATH override when set", async () => {
    process.env.REDEYE_CONFIG_PATH = "/tmp/override-config.json";

    vi.resetModules();
    const readCalls: string[] = [];
    const readFileSyncSpy = vi.fn((filePath: string) => {
      readCalls.push(String(filePath));
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    vi.doMock("fs", async (importOriginal: () => Promise<typeof import("fs")>) => {
      const actual = await importOriginal();
      return {
        ...actual,
        readFileSync: readFileSyncSpy,
        statSync: vi.fn(() => {
          const err: NodeJS.ErrnoException = new Error("ENOENT");
          err.code = "ENOENT";
          throw err;
        }),
      };
    });

    const mod = await import("./session-manager.js");
    mod.ensureAutoRestartRestored();

    expect(readCalls).toContain("/tmp/override-config.json");

    vi.doUnmock("fs");
  });
});
