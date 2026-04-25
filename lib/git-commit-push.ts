/**
 * lib/git-commit-push.ts
 *
 * Shared helper for API routes that mutate `.redeye/*` files which RedEye
 * CTO's TRIAGE phase syncs from origin/main on every iteration. Without
 * a commit + push, working-tree-only edits get wiped on the next sync.
 *
 * Push is best-effort: if the remote is offline or no upstream is set,
 * the local commit still survives and the directive is durable in git
 * history. Only writes that genuinely fail to commit signal back as
 * { committed: false }.
 *
 * Used by: /api/projects/[id]/{steer,pause,stop,backlog,answer}/route.ts
 */

import { spawn } from "child_process";

export interface CommitPushResult {
  committed: boolean;
  pushed: boolean;
}

function run(cmd: string, args: string[], cwd: string): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: "ignore" });
    proc.on("close", (code) => resolve({ code: code ?? -1 }));
    proc.on("error", () => resolve({ code: -1 }));
  });
}

/**
 * Add the listed paths, commit with the given message, and best-effort push.
 *
 * @param projectPath  cwd for the git operations
 * @param paths        relative paths inside projectPath to stage
 * @param message      commit message
 * @returns            { committed, pushed } — committed=false means the add
 *                     or commit step failed and the push was skipped
 */
export async function commitAndPush(
  projectPath: string,
  paths: string[],
  message: string
): Promise<CommitPushResult> {
  const add = await run("git", ["add", "--", ...paths], projectPath);
  if (add.code !== 0) return { committed: false, pushed: false };

  // `git commit` returns non-zero when there's nothing to commit (e.g.,
  // idempotent re-write produced identical bytes). Treat that as success
  // for our purposes — there's nothing to push, and the file already
  // matches what the caller wanted on disk.
  const commit = await run("git", ["commit", "-m", message], projectPath);
  if (commit.code !== 0) {
    // Check if it was just "nothing to commit" by testing for any unstaged
    // changes to the listed paths. If git status is clean for these paths,
    // there was nothing to do; otherwise, the commit really failed.
    const diff = await run("git", ["diff", "--quiet", "--", ...paths], projectPath);
    if (diff.code === 0) {
      // Clean — nothing to commit was the right outcome. Skip push.
      return { committed: true, pushed: false };
    }
    return { committed: false, pushed: false };
  }

  const push = await run("git", ["push"], projectPath);
  return { committed: true, pushed: push.code === 0 };
}
