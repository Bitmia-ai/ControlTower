/**
 * lib/atomic-write.ts
 *
 * Atomic file write primitive shared by all routes that update state.json
 * or other small JSON/text files concurrently. Writes to a unique temp
 * sibling, fsyncs, then renames over the target.
 *
 * Why unique tempfile names: same-pid concurrent writers (two API routes
 * handling requests in the same Node process) collide on a fixed tempfile
 * and corrupt each other.
 */

import fs from "fs/promises";
import crypto from "crypto";

export async function atomicWriteJson(targetPath: string, content: string): Promise<void> {
  const suffix = `${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
  const tmpPath = `${targetPath}.tmp.${suffix}`;
  const fh = await fs.open(tmpPath, "w");
  try {
    await fh.writeFile(content, "utf-8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    // best-effort cleanup if rename fails
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}
