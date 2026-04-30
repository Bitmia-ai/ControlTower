import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { isProcessRunning } from "./process-utils";

/**
 * Prune git worktrees inside the project root whose owning process is dead.
 *
 * Why this exists
 * ---------------
 * Claude Code creates worktrees under `.claude/worktrees/agent-*` for
 * isolated subagents. RedEye creates `.worktrees/T-*` for each task. Both
 * are locked while in use; both leak when the parent process dies before
 * release. Leaked worktrees inside a Next.js project root are catastrophic
 * for `next dev` (Turbopack walks them, blowing memory past tens of GB).
 *
 * The lock reason that `git worktree` records includes the owning PID:
 *   `claude agent agent-... (pid 3866)`
 *
 * If that PID is gone, the worktree is abandoned and safe to force-remove.
 * Worktrees with a live PID are left alone. Worktrees whose lock reason
 * doesn't expose a PID we can parse are also left alone — manual locks
 * shouldn't be touched without operator action.
 */

interface WorktreeEntry {
  path: string;
  branch: string | null;
  locked: boolean;
  lockReason: string | null;
}

/** Parse `git worktree list --porcelain` output into structured entries. */
export function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> | null = null;

  const flush = () => {
    if (current?.path) {
      entries.push({
        path: current.path,
        branch: current.branch ?? null,
        locked: current.locked ?? false,
        lockReason: current.lockReason ?? null,
      });
    }
    current = null;
  };

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      flush();
      current = { path: line.slice("worktree ".length) };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    } else if (line === "locked") {
      current.locked = true;
    } else if (line.startsWith("locked ")) {
      current.locked = true;
      current.lockReason = line.slice("locked ".length);
    }
  }
  flush();
  return entries;
}

/** Extract the owning PID from a lock reason string, or null if absent. */
export function extractLockPid(reason: string | null): number | null {
  if (!reason) return null;
  const m = reason.match(/\(pid\s+(\d+)\)/i);
  if (!m) return null;
  const pid = parseInt(m[1], 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isInsideProject(worktreePath: string, projectPath: string): boolean {
  // git worktree list can record paths case-aliased on case-insensitive
  // filesystems (e.g. /repo/ControlTower vs /repo/controltower).
  // Use realpath-resolved comparison so both forms match.
  let realProject: string;
  let realWorktree: string;
  try {
    realProject = fs.realpathSync(projectPath);
  } catch {
    realProject = path.resolve(projectPath);
  }
  try {
    realWorktree = fs.realpathSync(worktreePath);
  } catch {
    realWorktree = path.resolve(worktreePath);
  }
  const prefix = realProject.endsWith(path.sep) ? realProject : realProject + path.sep;
  return realWorktree.startsWith(prefix);
}

interface PruneResult {
  removed: string[];
  skippedAlive: string[];
  skippedUnknown: string[];
}

/**
 * Sweep agent + task worktrees inside the project root. Returns paths that
 * were removed, paths skipped because their owner is alive, and paths
 * skipped because the lock has no parseable PID.
 *
 * Never throws. Errors during individual removals are swallowed so one
 * stuck worktree can't block the others.
 */
export function pruneOrphanWorktrees(projectPath: string): PruneResult {
  const result: PruneResult = { removed: [], skippedAlive: [], skippedUnknown: [] };

  let listOutput: string;
  try {
    listOutput = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: projectPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return result; // not a git repo or git unavailable
  }

  const entries = parseWorktreeList(listOutput);

  for (const entry of entries) {
    if (!isInsideProject(entry.path, projectPath)) continue;
    // Skip the project root itself (the main checkout, not a worktree).
    if (entry.path === path.resolve(projectPath)) continue;

    const pid = extractLockPid(entry.lockReason);
    if (pid !== null && isProcessRunning(pid)) {
      result.skippedAlive.push(entry.path);
      continue;
    }
    if (entry.locked && pid === null) {
      // Locked for a reason we don't recognise — leave it for a human.
      result.skippedUnknown.push(entry.path);
      continue;
    }

    // Unlock if locked, then force-remove. Each step swallows errors.
    if (entry.locked) {
      try {
        execFileSync("git", ["worktree", "unlock", entry.path], {
          cwd: projectPath,
          stdio: ["ignore", "ignore", "ignore"],
        });
      } catch {
        // unlock may fail if already unlocked — proceed anyway
      }
    }
    try {
      execFileSync("git", ["worktree", "remove", "--force", entry.path], {
        cwd: projectPath,
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      // git may refuse if directory missing — fall through to rm
    }
    try {
      fs.rmSync(entry.path, { recursive: true, force: true });
    } catch {
      // best effort
    }
    result.removed.push(entry.path);
  }

  if (result.removed.length > 0) {
    try {
      execFileSync("git", ["worktree", "prune"], {
        cwd: projectPath,
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch {
      // ignore
    }
  }

  return result;
}
