/**
 * lib/atomic-write.ts
 *
 * Atomic file write primitive shared by all routes that update state.json
 * or other small JSON/text files concurrently. Writes to a unique temp
 * sibling, then renames over the target. The rename is atomic on POSIX
 * filesystems (a reader sees either the old file or the new file, never
 * a half-written one).
 *
 * Why unique tempfile names: same-pid concurrent writers (two API routes
 * handling requests in the same Node process) would collide on a fixed
 * tempfile and corrupt each other.
 */

import fs from "fs/promises";
import crypto from "crypto";

export async function atomicWriteJson(targetPath: string, content: string): Promise<void> {
  const suffix = `${process.pid}.${crypto.randomBytes(4).toString("hex")}`;
  const tmpPath = `${targetPath}.tmp.${suffix}`;
  try {
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    // best-effort cleanup if write or rename fails
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}
