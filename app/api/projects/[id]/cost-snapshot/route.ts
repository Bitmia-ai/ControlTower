// POST /api/projects/[id]/cost-snapshot
// Captures cost for a completed backlog item.
//
// If `state.item_cost_starts[taskId]` is present (set by cost-start when the task
// became active), the recorded cost is the DELTA: current_session_cost − start.
// This reflects only the work done on this task, not the cumulative session total.
//
// If no start record exists (e.g. older "Record now" manual use), the raw
// current session cost is recorded instead — preserving pre-T046 behaviour.
//
// Body: { taskId: string }
// Returns: { data: { taskId: string, cost_usd: number, recorded: boolean } }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getProjectByIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sumCurrentSessionCost } from "@/lib/cost-calculator";
import { readJsonBody } from "@/lib/json-body";
import type { RedEyeState } from "@/lib/redeye-types";

const TASK_ID_RE = /^T\d+$/;
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
    return NextResponse.json({ error: "taskId must match T<number>" }, { status: 400 });
  }

  // Read state.json first so we can check for a start baseline before
  // deciding whether to skip on zero current cost.
  const stateFilePath = safeRedeyePath(project.path, "state.json");

  let state: RedEyeState;
  try {
    const raw = await fs.readFile(stateFilePath, "utf-8");
    state = JSON.parse(raw) as RedEyeState;
  } catch {
    return NextResponse.json({ error: "Could not read state.json" }, { status: 500 });
  }

  const startCost = state.item_cost_starts?.[taskId];
  const hasStart = typeof startCost === "number";

  const current_cost = await sumCurrentSessionCost(project.path);

  // Legacy fast-path: no measurable current cost and no start baseline →
  // nothing useful to record. Signal recorded: false without touching state.json.
  // When a start baseline exists we always proceed so we can clear it and
  // record the delta (even if it clamps to 0).
  if (!hasStart && (!current_cost || current_cost <= 0)) {
    return NextResponse.json({ data: { taskId, cost_usd: 0, recorded: false } });
  }

  // Delta mode when a start baseline exists, raw mode otherwise.
  const cost_usd = hasStart
    ? Math.max(0, current_cost - (startCost as number))
    : current_cost;

  // Update item_costs and clear the consumed start baseline.
  if (!state.item_costs) {
    state.item_costs = {};
  }
  state.item_costs[taskId] = cost_usd;

  if (hasStart && state.item_cost_starts) {
    delete state.item_cost_starts[taskId];
  }

  try {
    await atomicWriteJson(stateFilePath, JSON.stringify(state, null, 2));
  } catch {
    return NextResponse.json({ error: "Could not write state.json" }, { status: 500 });
  }

  return NextResponse.json({ data: { taskId, cost_usd, recorded: true } });
}
