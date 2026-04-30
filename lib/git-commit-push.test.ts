// @vitest-environment node
/**
 * Tests for lib/git-commit-push.ts — durability guarantee for CEO-via-
 * dashboard actions (steer, pause, stop, task mutations, answers).
 *
 * Mocks `child_process.spawn` so the test is hermetic: no real git is
 * executed. The mock simulates the `close` and `error` event callback
 * pattern the production helper uses.
 *
 * Invariant: this helper COMMITS ONLY — it must never invoke `git push`.
 * Pushing is the user's job; the local commit alone is the durability
 * boundary that survives TRIAGE's sync-from-main.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// vi.hoisted ensures the spawn mock fn is available when the vi.mock
// factory runs (factories execute before any imports).
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));

vi.mock(import("child_process"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, spawn: mockSpawn };
});

import { commitAndPush } from "./git-commit-push";

/** Build a fake child process that emits `close` with the given code. */
function fakeProc(code: number): EventEmitter {
  const proc = new EventEmitter();
  process.nextTick(() => proc.emit("close", code));
  return proc;
}

/** Build a fake child process that emits `error` with the given Error. */
function errorProc(err: Error): EventEmitter {
  const proc = new EventEmitter();
  process.nextTick(() => proc.emit("error", err));
  return proc;
}

beforeEach(() => {
  mockSpawn.mockReset();
});

describe("commitAndPush", () => {
  it("happy path: add(0) → commit(0) returns { committed: true } (no push)", async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0)) // add
      .mockImplementationOnce(() => fakeProc(0)); // commit

    const result = await commitAndPush(
      "/tmp/proj",
      [".redeye/state.json"],
      "feat: x"
    );
    expect(result).toEqual({ committed: true });
    // Exactly two spawns: add, commit. No push.
    expect(mockSpawn).toHaveBeenCalledTimes(2);

    // Order assertion: add → commit (no push).
    expect(mockSpawn.mock.calls[0]?.[0]).toBe("git");
    expect(mockSpawn.mock.calls[0]?.[1]?.[0]).toBe("add");
    expect(mockSpawn.mock.calls[1]?.[1]?.[0]).toBe("commit");
  });

  it("invariant: never spawns `git push` on the happy path", async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0))
      .mockImplementationOnce(() => fakeProc(0));

    await commitAndPush("/tmp/proj", ["a.md"], "msg");
    // No call should have `push` as its first git arg.
    for (const call of mockSpawn.mock.calls) {
      const args = (call[1] as string[]) ?? [];
      expect(args[0]).not.toBe("push");
    }
  });

  it("nothing-to-commit idempotency: commit(1) + diff(0) returns { committed: true }", async () => {
    // commit returning non-zero with a clean diff means the listed paths
    // were unchanged — the helper treats this as success.
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0)) // add
      .mockImplementationOnce(() => fakeProc(1)) // commit (nothing to commit)
      .mockImplementationOnce(() => fakeProc(0)); // diff (clean → idempotent)

    const result = await commitAndPush("/tmp/proj", ["a.md"], "msg");
    expect(result).toEqual({ committed: true });
    expect(mockSpawn).toHaveBeenCalledTimes(3);
    expect(mockSpawn.mock.calls[2]?.[1]?.[0]).toBe("diff");
    // Still no push.
    for (const call of mockSpawn.mock.calls) {
      const args = (call[1] as string[]) ?? [];
      expect(args[0]).not.toBe("push");
    }
  });

  it("real commit failure: commit(1) + diff(1) returns { committed: false }", async () => {
    // Diff non-zero means there ARE staged differences — commit really failed.
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0)) // add
      .mockImplementationOnce(() => fakeProc(1)) // commit (failure)
      .mockImplementationOnce(() => fakeProc(1)); // diff (changes pending)

    const result = await commitAndPush("/tmp/proj", ["a.md"], "msg");
    expect(result).toEqual({ committed: false });
    expect(mockSpawn).toHaveBeenCalledTimes(3);
  });

  it("add failure: add(1) returns { committed: false } and never spawns commit", async () => {
    mockSpawn.mockImplementationOnce(() => fakeProc(1)); // add fails

    const result = await commitAndPush("/tmp/proj", ["a.md"], "msg");
    expect(result).toEqual({ committed: false });
    // Bail-out: only `add` was invoked.
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn.mock.calls[0]?.[1]?.[0]).toBe("add");
  });

  it("spawn `error` event resolves to code -1 (treated as failure)", async () => {
    mockSpawn.mockImplementationOnce(() => errorProc(new Error("ENOENT")));

    const result = await commitAndPush("/tmp/proj", ["a.md"], "msg");
    // The `add` step failed (code -1 from error event), short-circuiting.
    expect(result).toEqual({ committed: false });
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("git add is called with `--` separator and the caller-supplied paths (never `git add .` / `-A`)", async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0))
      .mockImplementationOnce(() => fakeProc(0));

    await commitAndPush(
      "/tmp/proj",
      [".redeye/state.json", ".redeye/tasks.md"],
      "msg"
    );
    const addArgs = mockSpawn.mock.calls[0]?.[1] as string[];
    expect(addArgs).toEqual([
      "add",
      "--",
      ".redeye/state.json",
      ".redeye/tasks.md",
    ]);

    // Across ALL spawn invocations in this test, no call should pass
    // a wholesale-stage flag.
    for (const call of mockSpawn.mock.calls) {
      const args = (call[1] as string[]) ?? [];
      expect(args).not.toContain(".");
      expect(args).not.toContain("-A");
      expect(args).not.toContain("--all");
    }
  });

  it("commit is called with -m and the caller-supplied message", async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0))
      .mockImplementationOnce(() => fakeProc(0));

    const message = "redeye: steer pause now";
    await commitAndPush("/tmp/proj", ["a.md"], message);
    const commitArgs = mockSpawn.mock.calls[1]?.[1] as string[];
    expect(commitArgs).toEqual(["commit", "-m", message]);
  });

  it("spawn is invoked with cwd=projectPath and stdio:'ignore'", async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc(0))
      .mockImplementationOnce(() => fakeProc(0));

    await commitAndPush("/tmp/proj", ["a.md"], "msg");
    for (const call of mockSpawn.mock.calls) {
      const opts = call[2] as { cwd: string; stdio: string };
      expect(opts.cwd).toBe("/tmp/proj");
      expect(opts.stdio).toBe("ignore");
    }
  });
});
