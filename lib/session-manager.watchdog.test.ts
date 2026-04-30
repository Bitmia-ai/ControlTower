// @vitest-environment node
/**
 * Watchdog / timer-driven tests for session-manager.ts.
 *
 * The exit-check interval, stall detection (SIGTERM + SIGKILL fallback),
 * pending-respawn cancellation, and the watcher-key cleanup-on-exit are
 * load-bearing for the autonomous loop staying healthy across CT
 * restarts and Claude process exits. These tests use vi.useFakeTimers
 * to drive the intervals deterministically rather than waiting on real
 * wall-clock time.
 *
 * Mock surface follows the same shape as session-manager.autorestart.test.ts:
 * spawnClaudeSession is stubbed so we never shell out to `claude`, and
 * fs/process.kill are mocked so we control "process running" state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Hoisted mock factories. Mirrors session-manager.test.ts so behaviour stays
// consistent — the watchdog logic reuses isProcessRunning, fs reads, and the
// ps/lsof path, which all need to be controllable.
// ---------------------------------------------------------------------------

const {
  mockStatSync,
  mockWriteFileSync,
  mockReadFileSync,
  mockUnlinkSync,
  mockMkdirSync,
  mockAccessSync,
  mockResolveTranscriptFile,
  mockExecFileSync,
  mockSpawnClaudeSession,
  mockPruneOrphanWorktrees,
} = vi.hoisted(() => ({
  mockStatSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockAccessSync: vi.fn(),
  mockResolveTranscriptFile: vi.fn(),
  mockExecFileSync: vi.fn(),
  mockSpawnClaudeSession: vi.fn(),
  mockPruneOrphanWorktrees: vi.fn(),
}));

vi.mock(import("fs"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    statSync: mockStatSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
    unlinkSync: mockUnlinkSync,
    mkdirSync: mockMkdirSync,
    accessSync: mockAccessSync,
  };
});

vi.mock(import("./transcript-file-resolver"), () => ({
  resolveTranscriptFile: mockResolveTranscriptFile,
  encodeProjectPath: vi.fn(),
}));

vi.mock(import("child_process"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execFileSync: mockExecFileSync,
  };
});

vi.mock(import("./claude-runner"), () => ({
  spawnClaudeSession: mockSpawnClaudeSession,
  runClaudeCommand: vi.fn(),
}));

vi.mock(import("./worktree-pruner"), () => ({
  pruneOrphanWorktrees: mockPruneOrphanWorktrees,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_PATH = "/tmp/test-project";
const PID_1 = 1111;
const PID_2 = 2222;
const FRESH_MTIME = Date.now() - 30 * 1000;
const STALE_MTIME = Date.now() - 11 * 60 * 1000; // > 10 min stall threshold

/**
 * Stand up `process.kill` so existence probes (signal 0) succeed only for
 * PIDs in the alive set. Real signals (SIGTERM/SIGKILL) succeed unless the
 * caller adds the PID to `unkillable` to simulate a zombie.
 */
function setupProcessKill(alivePids: Set<number>, unkillable: Set<number> = new Set()) {
  return vi.spyOn(process, "kill").mockImplementation(
    (pid: number, signal?: string | number) => {
      if (signal === 0 || signal === undefined) {
        if (alivePids.has(pid)) return true;
        const err: NodeJS.ErrnoException = new Error("ESRCH");
        err.code = "ESRCH";
        throw err;
      }
      if (unkillable.has(pid)) {
        // Simulate zombie / D-state: signal succeeds but process stays alive.
        return true;
      }
      // Normal signal: drop from alive set so isProcessRunning returns false.
      alivePids.delete(pid);
      return true;
    }
  );
}

beforeEach(() => {
  vi.resetModules(); // fresh module-level state per test
  vi.clearAllMocks();
  vi.useFakeTimers();

  // fs defaults: most things ENOENT; the few reads tests want must be set explicitly
  mockReadFileSync.mockImplementation(() => {
    const err: NodeJS.ErrnoException = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });
  mockStatSync.mockImplementation(() => {
    const err: NodeJS.ErrnoException = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });
  mockAccessSync.mockImplementation(() => {
    const err: NodeJS.ErrnoException = new Error("ENOENT");
    err.code = "ENOENT";
    throw err;
  });
  mockResolveTranscriptFile.mockReturnValue(null);
  // Default: lsof returns the project path for PID_1 / PID_2 (we only ever
  // assert one is current at a time).
  mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
    if (cmd === "lsof") {
      const pidArg = args[args.indexOf("-p") + 1];
      if (pidArg && (pidArg === String(PID_1) || pidArg === String(PID_2))) {
        return `p${pidArg}\ncwd\nn${PROJECT_PATH}\n`;
      }
    }
    return "";
  });
  mockPruneOrphanWorktrees.mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. checkInterval detects exit and schedules respawn
// ---------------------------------------------------------------------------

describe("checkInterval — exit detection + respawn", () => {
  it("detects exit and schedules a respawn after 5s", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    // Configure mocked spawns: first → PID_1, second (respawn) → PID_2.
    mockSpawnClaudeSession
      .mockReturnValueOnce({ pid: PID_1, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: PID_2, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(1);

    // Process dies between the spawn and the next exit check.
    alive.delete(PID_1);

    // First exit check (10s interval) sees the process gone.
    await vi.advanceTimersByTimeAsync(10_000);

    // Respawn timer is now pending (5s); not yet fired.
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(1);

    // Drain the 5s respawn delay.
    await vi.advanceTimersByTimeAsync(5_000);

    // Second spawn happened — different PID.
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);
  });

  it("does NOT respawn when steering.md has STOP", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith("steering.md")) {
        return "## Directives\n\nSTOP — CEO directed\n";
      }
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    alive.delete(PID_1);
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(5_000);

    // Respawn was suppressed — only the original spawn happened.
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. pendingRespawn is cancelled when stopSession runs during the 5s window
// ---------------------------------------------------------------------------

describe("pendingRespawn cancellation", () => {
  it("stopSession during the 5s respawn window cancels the timer (no double-spawn)", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // Process exits.
    alive.delete(PID_1);
    await vi.advanceTimersByTimeAsync(10_000);

    // Respawn is queued (not yet fired). User clicks Stop.
    await sm.stopSession(PROJECT_PATH, "cto");

    // Drive past the 5s respawn window; it must NOT fire because stopSession
    // cleared the pendingRespawn map entry.
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(10_000);

    // Only the original spawn ran. No second spawn from a stale timer.
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(1);
  });

  it("explicit startSession during the 5s window cancels the queued respawn", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockSpawnClaudeSession
      .mockReturnValueOnce({ pid: PID_1, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: PID_2, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");
    alive.delete(PID_1);

    // Exit detected, respawn queued.
    await vi.advanceTimersByTimeAsync(10_000);

    // Manual restart cancels the queued timer and spawns immediately.
    await sm.startSession(PROJECT_PATH, "cto");
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);

    // Drain past the 5s window — no third spawn from the cancelled timer.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 3. isProjectIdle blocks respawn even when autoRestartEnabled
// ---------------------------------------------------------------------------

describe("isProjectIdle gate", () => {
  it("blocks respawn when digest.json reports an intentionally idle project", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith("digest.json")) {
        return JSON.stringify({
          phase: "triage",
          phase_status: "complete",
          env_healthy: true,
          overdue_schedules: 0,
          ceo_answers_pending: 0,
          tasks_summary: { ceo_pending: 0, triaged_planned: 0, discovered_pending: 0 },
        });
      }
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");
    alive.delete(PID_1);

    // Exit-check fires and the idle gate short-circuits before scheduling a
    // respawn timer at all (drops autorestart marker too).
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(1);
  });

  it("respawn proceeds when digest reports actionable work (idle gate is precise)", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockReadFileSync.mockImplementation((p: string) => {
      if (String(p).endsWith("digest.json")) {
        return JSON.stringify({
          phase: "triage",
          phase_status: "complete",
          env_healthy: true,
          overdue_schedules: 0,
          ceo_answers_pending: 0,
          // One actionable CEO request keeps the loop running.
          tasks_summary: { ceo_pending: 1, triaged_planned: 0, discovered_pending: 0 },
        });
      }
      const err: NodeJS.ErrnoException = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    });

    mockSpawnClaudeSession
      .mockReturnValueOnce({ pid: PID_1, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: PID_2, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");
    alive.delete(PID_1);

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 4. watcher key cleanup on exit (Fix 2 regression test)
// ---------------------------------------------------------------------------

describe("watcher key cleanup on respawn", () => {
  it("deletes the watcher key on exit so respawn installs a fresh checkInterval (PID-2 also detected on exit)", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockSpawnClaudeSession
      .mockReturnValueOnce({ pid: PID_1, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: PID_2, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: 3333, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // Round 1: PID_1 exits → respawn spawns PID_2.
    alive.delete(PID_1);
    alive.add(PID_2); // simulate PID_2 alive after respawn
    await vi.advanceTimersByTimeAsync(10_000); // exit check
    await vi.advanceTimersByTimeAsync(5_000);  // respawn
    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);

    // Round 2: if the watcher key wasn't cleaned up, PID_2's
    // installSessionWatchers would short-circuit and there'd be no
    // checkInterval polling its existence — so we'd never spawn a third
    // process when PID_2 also exits. Drive PID_2 exit and assert the new
    // watcher caught it.
    alive.delete(PID_2);
    await vi.advanceTimersByTimeAsync(10_000); // exit check on the FRESH watcher
    await vi.advanceTimersByTimeAsync(5_000);  // respawn

    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// 5. Stall detection — SIGTERM then SIGKILL fallback
// ---------------------------------------------------------------------------

describe("stall detection — SIGTERM + SIGKILL fallback", () => {
  it("sends SIGTERM when transcript mtime is stale and process is alive", async () => {
    const alive = new Set<number>([PID_1]);
    const killSpy = setupProcessKill(alive);

    mockResolveTranscriptFile.mockReturnValue("/tmp/cto-transcript.jsonl");

    // Two stat calls matter for the stall check inside makeSessionInfo:
    //  - transcript mtime  → STALE_MTIME (drives `lastActivity`)
    //  - pid file mtime    → far past, so `processAge > 120_000` is true
    mockStatSync.mockImplementation((p: string) => {
      if (String(p).includes("session-cto.pid")) {
        // pid file mtime: 5 minutes ago → process age > 120_000 (grace passed)
        return { mtimeMs: Date.now() - 5 * 60 * 1000, isDirectory: () => false };
      }
      // transcript mtime: 11 minutes ago → stalled
      return { mtimeMs: STALE_MTIME, isDirectory: () => false };
    });

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // Stall check runs every 60s.
    await vi.advanceTimersByTimeAsync(60_000);

    // SIGTERM was issued (signal != 0) for PID_1. setupProcessKill drops
    // PID_1 from `alive` on receiving any real signal, simulating a clean
    // termination.
    const sigtermCalls = killSpy.mock.calls.filter(
      (c) => c[0] === PID_1 && c[1] === "SIGTERM"
    );
    expect(sigtermCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to SIGKILL after 10s if process is still alive", async () => {
    // Mark PID_1 as unkillable on real signals so SIGTERM is observed but the
    // process doesn't die — forcing the SIGKILL deadline to fire.
    const alive = new Set<number>([PID_1]);
    const unkillable = new Set<number>([PID_1]);
    const killSpy = setupProcessKill(alive, unkillable);

    mockResolveTranscriptFile.mockReturnValue("/tmp/cto-transcript.jsonl");
    mockStatSync.mockImplementation((p: string) => {
      if (String(p).includes("session-cto.pid")) {
        return { mtimeMs: Date.now() - 5 * 60 * 1000, isDirectory: () => false };
      }
      return { mtimeMs: STALE_MTIME, isDirectory: () => false };
    });

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // 60s — stall check + SIGTERM
    await vi.advanceTimersByTimeAsync(60_000);
    // 10s — SIGKILL deadline fires
    await vi.advanceTimersByTimeAsync(10_000);

    const sigkillCalls = killSpy.mock.calls.filter(
      (c) => c[0] === PID_1 && c[1] === "SIGKILL"
    );
    expect(sigkillCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("after stall-driven kill, respawn happens once the process exits", async () => {
    const alive = new Set<number>([PID_1]);
    const killSpy = setupProcessKill(alive);

    mockResolveTranscriptFile.mockReturnValue("/tmp/cto-transcript.jsonl");
    mockStatSync.mockImplementation((p: string) => {
      if (String(p).includes("session-cto.pid")) {
        return { mtimeMs: Date.now() - 5 * 60 * 1000, isDirectory: () => false };
      }
      return { mtimeMs: STALE_MTIME, isDirectory: () => false };
    });

    mockSpawnClaudeSession
      .mockReturnValueOnce({ pid: PID_1, logFile: "/tmp/cto.jsonl" })
      .mockReturnValueOnce({ pid: PID_2, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // Stall fires SIGTERM, our mock drops PID_1 from `alive` immediately
    // (clean-exit simulation). The waitForExit poller (1s interval) then
    // triggers the respawn.
    await vi.advanceTimersByTimeAsync(60_000); // stall check + SIGTERM
    await vi.advanceTimersByTimeAsync(1_000);  // first waitForExit tick

    expect(mockSpawnClaudeSession).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 6. Smoke: stopSession after spawn cleans up state without throwing
// ---------------------------------------------------------------------------

describe("stopSession smoke", () => {
  it("clears autorestart, kills the process, and is safe to call twice", async () => {
    const alive = new Set<number>([PID_1]);
    setupProcessKill(alive);

    mockSpawnClaudeSession.mockReturnValue({ pid: PID_1, logFile: "/tmp/cto.jsonl" });

    const sm = await import("./session-manager");
    await sm.startSession(PROJECT_PATH, "cto");

    // First stop kills PID_1; mock drops it from alive on any real signal.
    await sm.stopSession(PROJECT_PATH, "cto");
    expect(alive.has(PID_1)).toBe(false);

    // Second stop is a no-op.
    await expect(sm.stopSession(PROJECT_PATH, "cto")).resolves.toBeUndefined();
  });
});
