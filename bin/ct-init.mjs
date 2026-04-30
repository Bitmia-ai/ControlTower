#!/usr/bin/env node
// bin/ct-init.mjs — Interactive CLI scaffolder for `.redeye/` files.
//
// Usage:
//   ct-init                      # interactive
//   ct-init --force              # overwrite existing .redeye/
//   ct-init --help               # print usage
//
// Prereqs:
//   - Node >= 18
//   - cwd must be a git repo (we check via existsSync('.git'), no subprocess)
//
// This is a thin shell over lib/ct-init-core.mjs — all content generation and
// file writes live in the core module which is unit-tested.

import { createInterface } from "readline";
import { existsSync } from "fs";
import { dirname, basename, join, resolve } from "path";
import { fileURLToPath } from "url";

import { runInit } from "../lib/ct-init-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HELP = `
Control Tower init — scaffolds .redeye/ control files into the current git repo.

Usage:
  ct-init [options]

Options:
  --force       Overwrite an existing .redeye/ directory.
  --help, -h    Print this help and exit.

Interactive prompts:
  - Project name (default: current directory name)
  - RedEye plugin path (default: ~/redeye)
  - Add a sample task to get started? (y/N)

After completion:
  1. Run Control Tower:  npx control-tower  (or: npm start)
  2. Open http://localhost:3200
  3. Click "Add Project" and point it at this repo.
  4. Click Start — RedEye will take over.
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    help: args.includes("--help") || args.includes("-h"),
    force: args.includes("--force"),
  };
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (Number.isNaN(major) || major < 18) {
    console.error(
      `ct-init: Node.js >= 18 required. You have ${process.version}.`
    );
    process.exit(1);
  }
}

function checkGitRepo(cwd) {
  if (!existsSync(join(cwd, ".git"))) {
    console.error("ct-init: this directory is not a git repository.");
    console.error("Run `git init` first, then re-run ct-init.");
    process.exit(1);
  }
}

function checkRedeyeDir(cwd, force) {
  const redeyeDir = join(cwd, ".redeye");
  if (existsSync(redeyeDir) && !force) {
    console.error(
      "ct-init: .redeye/ already exists. Pass --force to overwrite."
    );
    process.exit(1);
  }
}

/**
 * Build a queueing line reader. Reads all 'line' events from stdin and
 * exposes a `next(prompt, default)` that prints the prompt then either
 * returns the next buffered line or waits for one. Survives both interactive
 * TTY and piped stdin (where rl.question() can race with EOF).
 */
function makeLineReader() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const queue = [];
  const waiters = [];
  let closed = false;

  rl.on("line", (line) => {
    if (waiters.length > 0) {
      const w = waiters.shift();
      w(line);
    } else {
      queue.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length > 0) {
      const w = waiters.shift();
      w(null);
    }
  });

  function next(prompt) {
    process.stdout.write(prompt);
    if (queue.length > 0) {
      return Promise.resolve(queue.shift());
    }
    if (closed) return Promise.resolve(null);
    return new Promise((resolveLine) => waiters.push(resolveLine));
  }

  function close() {
    rl.close();
  }

  return { next, close };
}

function applyDefault(line, defaultValue) {
  if (line == null) return defaultValue;
  const trimmed = String(line).trim();
  return trimmed.length > 0 ? trimmed : defaultValue;
}

async function gatherInputs(cwd) {
  const reader = makeLineReader();
  try {
    console.log("");
    console.log("Control Tower — Project Setup");
    console.log("");

    const defaultName = basename(cwd);
    const projectName = applyDefault(
      await reader.next(`? Project name (${defaultName}): `),
      defaultName
    );
    const redeyePluginPath = applyDefault(
      await reader.next("? RedEye plugin path (~/redeye): "),
      "~/redeye"
    );
    const sampleAns = applyDefault(
      await reader.next("? Add a sample task to get started? (y/N): "),
      "n"
    );
    const addSampleTask = /^y(es)?$/i.test(sampleAns);

    console.log("");

    return { projectName, redeyePluginPath, addSampleTask };
  } finally {
    reader.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  checkNodeVersion();

  const cwd = process.cwd();
  checkGitRepo(cwd);
  checkRedeyeDir(cwd, opts.force);

  const inputs = await gatherInputs(cwd);

  const onWrite = (name) => console.log(`  Writing .redeye/${name} ...`);

  try {
    await runInit({
      projectName: inputs.projectName,
      cwd,
      redeyePluginPath: inputs.redeyePluginPath,
      addSampleTask: inputs.addSampleTask,
      force: opts.force,
      onWrite,
    });
  } catch (err) {
    console.error("ct-init: failed to scaffold .redeye/");
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }

  console.log("");
  console.log("Done! Your project is ready.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Run Control Tower:  npx control-tower  (or: npm start)");
  console.log("  2. Open http://localhost:3200");
  console.log(
    "  3. Click \"Add Project\" and point it at: " + cwd
  );
  console.log(
    "  4. Click Start on the project card — RedEye will take it from here."
  );
  console.log("");
}

main().catch((err) => {
  console.error("ct-init: unexpected error");
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
