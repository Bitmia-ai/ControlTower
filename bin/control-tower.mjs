#!/usr/bin/env node
// bin/control-tower.mjs — CLI launcher for Control Tower dashboard.
// Checks that the app has been built, then starts the Next.js server.
// Usage: control-tower   (after npm install -g control-tower or npx control-tower)

import { spawn } from "child_process";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const nextBin = join(projectRoot, "node_modules", ".bin", "next");
const nextDir = join(projectRoot, ".next");

if (!existsSync(nextDir)) {
  console.error("Control Tower: .next/ build directory not found.");
  console.error(
    "Please run `npm run build` (or `npm install && npm run build`) first."
  );
  console.error("");
  console.error("Usage:");
  console.error("  cd " + projectRoot);
  console.error("  npm run build");
  console.error("  control-tower     # or: npm start");
  process.exit(1);
}

if (!existsSync(nextBin)) {
  console.error(
    "Control Tower: next binary not found at " + nextBin
  );
  console.error("Please run `npm install` first.");
  process.exit(1);
}

console.log("Starting Control Tower at http://127.0.0.1:3200 ...");

const child = spawn(
  nextBin,
  ["start", "--hostname", "127.0.0.1", "--port", "3200"],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
