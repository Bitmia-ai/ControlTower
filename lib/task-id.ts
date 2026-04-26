/**
 * lib/backlog-id.ts
 *
 * Centralised BL-xxx ID allocation.
 *
 * SINGLE-PROCESS ASSUMPTION: This utility is designed for a single-process
 * Next.js API server. It is NOT safe for concurrent multi-process usage
 * because there is no advisory file lock. For the current scale this is
 * acceptable; add a lock file mechanism if the system ever becomes
 * multi-process.
 */

import fs from "fs/promises";
import path from "path";
import { readState, scanMaxBacklogId } from "./redeye-files";
import { atomicWriteJson } from "./atomic-write";
import type { RedEyeState } from "./redeye-types";

/**
 * Compute and atomically allocate the next BL-xxx ID for the given project.
 *
 * Algorithm:
 *   1. Read `counters.next_task_id` from `state.json` (0 if file missing).
 *   2. Scan `backlog.md` for the highest numeric BL suffix found.
 *   3. nextId = max(stateCounter - 1, scanMax) + 1
 *   4. Write `nextId + 1` back to `state.json` as the new `counters.next_task_id`.
 *   5. Return `"BL-" + String(nextId).padStart(3, "0")`.
 */
export async function getNextTaskId(projectPath: string): Promise<string> {
  const [state, scanMax] = await Promise.all([
    readState(projectPath),
    scanMaxBacklogId(projectPath),
  ]);

  const stateCounter: number = state?.counters?.next_task_id ?? 0;
  // stateCounter is the *next* ID the counter believes should be used.
  // scanMax is the highest ID already present in backlog.md.
  // We treat (stateCounter - 1) as the last allocated counter value and
  // scanMax as the last allocated scan value, then take the max and add 1.
  const lastAllocated = Math.max(stateCounter - 1, scanMax);
  const nextId = lastAllocated + 1;

  // Write updated counter back atomically (full JSON rewrite).
  await writeNextBlId(projectPath, state, nextId + 1);

  return "BL-" + String(nextId).padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function writeNextBlId(
  projectPath: string,
  existingState: RedEyeState | null,
  newNextBlId: number
): Promise<void> {
  const redeyeDir = path.resolve(projectPath, ".redeye");
  const stateFilePath = path.join(redeyeDir, "state.json");

  let updated: Record<string, unknown>;

  if (existingState) {
    // Merge into existing state — cast to avoid deep-typing issues.
    const existing = existingState as unknown as Record<string, unknown>;
    updated = {
      ...existing,
      counters: {
        ...(existing.counters as Record<string, unknown>),
        next_task_id: newNextBlId,
      },
    };
  } else {
    // state.json was missing — create a minimal skeleton so the counter is
    // persisted. This keeps future reads self-consistent.
    updated = {
      schema_version: 1,
      counters: {
        next_task_id: newNextBlId,
        next_q_id: 1,
      },
    };
  }

  // Ensure .redeye directory exists (it should, but be defensive).
  await fs.mkdir(redeyeDir, { recursive: true });
  await atomicWriteJson(stateFilePath, JSON.stringify(updated, null, 2));
}
