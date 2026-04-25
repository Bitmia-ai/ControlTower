// POST /api/projects/[id]/cost-start
// Records the session cost at the moment a backlog item becomes active.
// Later used by cost-snapshot to compute per-task delta (end - start).
// Body: { blId: string }
// Returns:
//   - { data: { blId, cost_at_start, recorded: true } } on first record
//   - { data: { blId, skipped: true } } when a start is already recorded (idempotent)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getProjectByIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sumCurrentSessionCost } from "@/lib/cost-calculator";
import type { RedEyeState } from "@/lib/redeye-types";

const BL_ID_RE = /^BL-\d+$/;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const blId = (body as Record<string, unknown>)?.blId;
  if (typeof blId !== "string" || !BL_ID_RE.test(blId)) {
    return NextResponse.json({ error: "blId must match BL-<number>" }, { status: 400 });
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
  if (state.item_cost_starts?.[blId] !== undefined) {
    return NextResponse.json({ data: { blId, skipped: true } });
  }

  const cost = await sumCurrentSessionCost(project.path);

  if (!state.item_cost_starts) {
    state.item_cost_starts = {};
  }
  state.item_cost_starts[blId] = cost;

  try {
    await atomicWriteJson(stateFilePath, JSON.stringify(state, null, 2));
  } catch {
    return NextResponse.json({ error: "Could not write state.json" }, { status: 500 });
  }

  return NextResponse.json({ data: { blId, cost_at_start: cost, recorded: true } });
}
