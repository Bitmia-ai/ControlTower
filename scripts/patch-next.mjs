#!/usr/bin/env node
// Patches node_modules/next/dist/build/utils.js to prevent /_global-error
// from being added to staticPaths, which avoids the null-React prerender
// crash in Next.js 16.2.4 + Turbopack + React 19.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const utilsPath = join(__dirname, "../node_modules/next/dist/build/utils.js");

let content = readFileSync(utilsPath, "utf8");

const broken = "            appConfig: {}";
const fixed = "            appConfig: { revalidate: 0 } // patched: skip /_global-error prerender (Next.js 16 + Turbopack null-React bug)";

if (content.includes(fixed)) {
  console.log("[patch-next] Already patched, skipping.");
  process.exit(0);
}

const CONTEXT = `    // Skip page data collection for synthetic _global-error routes
    if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {`;

if (!content.includes(CONTEXT)) {
  console.error("[patch-next] Patch target not found — Next.js may have changed. Skipping.");
  process.exit(0);
}

// Only patch the appConfig inside the UNDERSCORE_GLOBAL_ERROR_ROUTE block
const blockStart = content.indexOf(CONTEXT);
const blockEnd = content.indexOf("};", blockStart) + 2;
const block = content.slice(blockStart, blockEnd);

if (!block.includes(broken)) {
  console.error("[patch-next] appConfig: {} not found in _global-error block. Skipping.");
  process.exit(0);
}

const patchedBlock = block.replace(broken, fixed);
content = content.slice(0, blockStart) + patchedBlock + content.slice(blockEnd);

writeFileSync(utilsPath, content, "utf8");
console.log("[patch-next] Patched next/dist/build/utils.js successfully.");
