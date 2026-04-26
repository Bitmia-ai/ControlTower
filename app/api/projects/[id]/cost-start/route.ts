// POST /api/projects/[id]/cost-start
// Records the session cost at the moment a backlog item becomes active.
// Later used by cost-snapshot to compute per-task delta (end - start).
// Body: { taskId: string }
// Returns:
//   - { data: { taskId, cost_at_start, recorded: true } } on first record
//   - { data: { taskId, skipped: true } } when a start is already recorded (idempotent)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getProjectByIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sumCurrentSessionCost } from "@/lib/cost-calculator";
import { readJsonBody } from "@/lib/json-body";
import type { RedEyeState } from "@/lib/redeye-types";

const TASK_ID_RE = /^BL-\d+$/;
const MAX_BODY_BYTES = 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
  if (!r.ok) return r.response;
  const taskId = r.data?.taskId;
  if (typeof taskId !== "string" || !TASK_ID_RE.test(taskId)) {
    return NextResponse.json({ error: "taskId must match BL-<number>" }, { status: 400 });
  }

  const stateFilePath = safeRedeyePath(project.path, "state.json");
  let state: RedEyeState;
  try {
    const raw = await fs.readFile(stateFilePath, "utf-8");
    state = JSON.parse(raw) as RedEyeState;
  } catch {
    return NextResponse.json({ error: "Could not read state.json" }, { status: 500 });
  }

  // Idempotency guard: if a start is already recorded, skip the write.
  // The first snapshot is always the correct baseline.
  if (state.item_cost_starts?.[taskId] !== undefined) {
    return NextResponse.json({ data: { taskId, skipped: true } });
  }

  const cost = await sumCurrentSessionCost(project.path);

  if (!state.item_cost_starts) {
    state.item_cost_starts = {};
  }
  state.item_cost_starts[taskId] = cost;

  try {
    await atomicWriteJson(stateFilePath, JSON.stringify(state, null, 2));
  } catch {
    return NextResponse.json({ error: "Could not write state.json" }, { status: 500 });
  }

  return NextResponse.json({ data: { taskId, cost_at_start: cost, recorded: true } });
}
