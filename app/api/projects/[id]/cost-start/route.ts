// POST /api/projects/[id]/cost-start
// Records the session cost at the moment a task becomes active.
// Later used by cost-snapshot to compute per-task delta (end - start).
// Body: { taskId: string }
// Returns:
//   - { data: { taskId, cost_at_start, recorded: true } } on first record
//   - { data: { taskId, skipped: true } } when a start is already recorded (idempotent)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sumCurrentSessionCost } from "@/lib/cost-calculator";
import { readJsonBody } from "@/lib/json-body";
import { withProjectLock } from "@/lib/state-mutex";
import { TASK_ID_RE } from "@/lib/task-id";
import type { RedEyeState } from "@/lib/redeye-types";

const MAX_BODY_BYTES = 1024;

type StartResult =
  | { kind: "skipped"; taskId: string }
  | { kind: "recorded"; taskId: string; cost_at_start: number }
  | { kind: "read-error" }
  | { kind: "write-error" };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseProjectIndex(id);
  if (index === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const project = await getProjectByIndex(index);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
  if (!r.ok) return r.response;
  const taskId = r.data?.taskId;
  if (typeof taskId !== "string" || !TASK_ID_RE.test(taskId)) {
    return NextResponse.json({ error: "taskId must match T<number>" }, { status: 400 });
  }

  const stateFilePath = safeRedeyePath(project.path, "state.json");

  // Serialize the read → idempotency-check → write per project so two
  // concurrent cost-start requests for the same taskId can't both pass
  // the guard on a stale snapshot and double-write the start baseline.
  const result: StartResult = await withProjectLock(project.path, async () => {
    let state: RedEyeState;
    try {
      const raw = await fs.readFile(stateFilePath, "utf-8");
      state = JSON.parse(raw) as RedEyeState;
    } catch {
      return { kind: "read-error" } as const;
    }

    // Idempotency guard: if a start is already recorded, skip the write.
    // The first snapshot is always the correct baseline.
    if (state.item_cost_starts?.[taskId] !== undefined) {
      return { kind: "skipped", taskId } as const;
    }

    const cost = await sumCurrentSessionCost(project.path);

    if (!state.item_cost_starts) {
      state.item_cost_starts = {};
    }
    state.item_cost_starts[taskId] = cost;

    try {
      await atomicWriteJson(stateFilePath, JSON.stringify(state, null, 2));
    } catch {
      return { kind: "write-error" } as const;
    }

    return { kind: "recorded", taskId, cost_at_start: cost } as const;
  });

  if (result.kind === "read-error") {
    return NextResponse.json({ error: "Could not read state.json" }, { status: 500 });
  }
  if (result.kind === "write-error") {
    return NextResponse.json({ error: "Could not write state.json" }, { status: 500 });
  }
  if (result.kind === "skipped") {
    return NextResponse.json({ data: { taskId: result.taskId, skipped: true } });
  }
  return NextResponse.json({
    data: { taskId: result.taskId, cost_at_start: result.cost_at_start, recorded: true },
  });
}
