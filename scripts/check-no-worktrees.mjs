#!/usr/bin/env node
/**
 * Refuse to start `next dev` if git worktrees live inside the project root.
 *
 * Why this guard exists
 * ---------------------
 * Turbopack walks the project root to build its file index and watch tree.
 * It does not honor .gitignore for that walk. If `.claude/worktrees/` or
 * `.worktrees/` contain agent worktrees (each a full project tree clone),
 * Turbopack scans every nested copy and the in-memory module graph
 * explodes — the dev server can consume tens of GB and freeze the machine.
 *
 * Worktrees are still legitimate; they just must not live inside the
 * project root that Next.js watches. Move them with `git worktree move`
 * or remove them with `git worktree remove -f` before running `next dev`.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const watched = [
  path.join(projectRoot, ".claude", "worktrees"),
  path.join(projectRoot, ".worktrees"),
];

const offenders = [];
for (const dir of watched) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      if (statSync(full).isDirectory()) offenders.push(full);
    } catch {
      // unreadable entry — skip
    }
  }
}

if (offenders.length === 0) process.exit(0);

const rel = (p) => path.relative(projectRoot, p);
process.stderr.write(
  [
    "",
    "✗ Aborting `next dev` — git worktrees inside the project root will",
    "  cause Turbopack to scan every nested copy and balloon memory.",
    "",
    "  Found:",
    ...offenders.map((p) => `    - ${rel(p)}`),
    "",
    "  Fix:",
    "    git worktree list                    # see what's tracked",
    "    git worktree remove -f -f <path>     # for each unwanted worktree",
    "    rm -rf .claude/worktrees/agent-*     # if directories survive",
    "    rm -rf .worktrees/*",
    "",
    "  See scripts/check-no-worktrees.mjs for context.",
    "",
  ].join("\n")
);

// Best-effort hint: dump `git worktree list` (fixed argv — no shell interp).
try {
  const out = execFileSync("git", ["worktree", "list"], {
    cwd: projectRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  process.stderr.write(`  git worktree list output:\n${out}\n`);
} catch {
  // git not available or not a repo — skip
}

process.exit(1);
