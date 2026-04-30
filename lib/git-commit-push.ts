/**
 * lib/git-commit-push.ts
 *
 * Shared helper for API routes that mutate `.redeye/*` files which RedEye
 * CTO's TRIAGE phase syncs from origin/main on every iteration. Without
 * a commit, working-tree-only edits get wiped on the next sync.
 *
 * **Commits only, never pushes.** Pushing is the user's job — the
 * dashboard never reaches out to a remote. The local commit alone is
 * what gives the directive durability in git history; TRIAGE's
 * sync-from-main reconciles via the local branch state.
 *
 * Used by: /api/projects/[id]/{steer,pause,stop,tasks,answer}/route.ts
 */

import { spawn } from "child_process";

export interface CommitPushResult {
  committed: boolean;
}

function run(cmd: string, args: string[], cwd: string): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: "ignore" });
    proc.on("close", (code) => resolve({ code: code ?? -1 }));
    proc.on("error", () => resolve({ code: -1 }));
  });
}

/**
 * Add the listed paths and commit with the given message. Never pushes —
 * the local commit is the durability boundary; remote sync is the user's
 * responsibility.
 *
 * @param projectPath  cwd for the git operations
 * @param paths        relative paths inside projectPath to stage
 * @param message      commit message
 * @returns            { committed } — committed=false means the add or
 *                     commit step failed
 */
export async function commitAndPush(
  projectPath: string,
  paths: string[],
  message: string
): Promise<CommitPushResult> {
  const add = await run("git", ["add", "--", ...paths], projectPath);
  if (add.code !== 0) return { committed: false };

  // `git commit` returns non-zero when there's nothing to commit (e.g.,
  // idempotent re-write produced identical bytes). Treat that as success
  // for our purposes — there's nothing to commit, and the file already
  // matches what the caller wanted on disk.
  const commit = await run("git", ["commit", "-m", message], projectPath);
  if (commit.code !== 0) {
    // Check if it was just "nothing to commit" by testing for any unstaged
    // changes to the listed paths. If git status is clean for these paths,
    // there was nothing to do; otherwise, the commit really failed.
    const diff = await run("git", ["diff", "--quiet", "--", ...paths], projectPath);
    if (diff.code === 0) {
      // Clean — nothing to commit was the right outcome.
      return { committed: true };
    }
    return { committed: false };
  }

  return { committed: true };
}
