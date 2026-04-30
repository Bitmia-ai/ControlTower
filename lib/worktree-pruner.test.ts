// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseWorktreeList, extractLockPid } from "./worktree-pruner";

describe("parseWorktreeList", () => {
  it("returns an empty array for empty input", () => {
    expect(parseWorktreeList("")).toEqual([]);
  });

  it("parses a single unlocked worktree", () => {
    const out = [
      "worktree /Users/me/proj",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
    ].join("\n");
    expect(parseWorktreeList(out)).toEqual([
      { path: "/Users/me/proj", branch: "refs/heads/main", locked: false, lockReason: null },
    ]);
  });

  it("parses a locked worktree with a lock reason", () => {
    const out = [
      "worktree /Users/me/proj",
      "HEAD abc",
      "branch refs/heads/main",
      "",
      "worktree /Users/me/proj/.claude/worktrees/agent-x",
      "HEAD def",
      "branch refs/heads/agent-x",
      "locked claude agent agent-x (pid 4321)",
      "",
    ].join("\n");
    const entries = parseWorktreeList(out);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({
      path: "/Users/me/proj/.claude/worktrees/agent-x",
      branch: "refs/heads/agent-x",
      locked: true,
      lockReason: "claude agent agent-x (pid 4321)",
    });
  });

  it("treats a bare `locked` line (no reason) as locked with null reason", () => {
    const out = [
      "worktree /tmp/wt",
      "branch refs/heads/x",
      "locked",
      "",
    ].join("\n");
    const entries = parseWorktreeList(out);
    expect(entries[0]).toEqual({
      path: "/tmp/wt",
      branch: "refs/heads/x",
      locked: true,
      lockReason: null,
    });
  });
});

describe("extractLockPid", () => {
  it("returns null for null input", () => {
    expect(extractLockPid(null)).toBeNull();
  });
  it("returns null when no pid is present", () => {
    expect(extractLockPid("manual lock")).toBeNull();
  });
  it("extracts the pid from a claude lock reason", () => {
    expect(extractLockPid("claude agent agent-x (pid 4321)")).toBe(4321);
  });
  it("ignores non-positive pids", () => {
    expect(extractLockPid("(pid 0)")).toBeNull();
  });
  it("is case insensitive on the keyword", () => {
    expect(extractLockPid("(PID 99)")).toBe(99);
  });
});

// pruneOrphanWorktrees needs heavy filesystem + child_process mocking; the
// integration is exercised end-to-end via session-manager tests. Here we
// cover the parsing primitives that drive the decision logic, since those
// are where bugs would silently let real worktrees survive or innocent
// ones get nuked.

describe("pruneOrphanWorktrees integration smoke", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an empty result and never throws when git is unavailable", async () => {
    vi.doMock("child_process", () => ({
      execFileSync: vi.fn(() => {
        throw new Error("git: command not found");
      }),
    }));
    const { pruneOrphanWorktrees } = await import("./worktree-pruner");
    const result = pruneOrphanWorktrees("/nonexistent");
    expect(result).toEqual({ removed: [], skippedAlive: [], skippedUnknown: [] });
  });
});
