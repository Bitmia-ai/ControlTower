// GET /api/projects/[id]/tasks/[taskId]/duration
// Returns { data: TaskDurationResult } where durationMs is null when the
// iteration_log window does not cover the task. Read-only sub-resource of
// the task endpoint — kept separate so the UI can fetch it in parallel
// without coupling to the heavier tasks.md read path.
//
// Errors: 400 invalid taskId, 404 project missing, 500 unexpected.

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore } from "@/lib/app";
import { TASK_ID_RE } from "@/lib/task-id";
import { computeTaskDuration } from "@/lib/task-duration";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id, taskId } = await params;

    if (!TASK_ID_RE.test(taskId)) {
      return NextResponse.json(
        { error: "taskId must match T<number>" },
        { status: 400 }
      );
    }

    const index = parseProjectIndex(id);
    if (index === null) {
      return NextResponse.json(
        { error: "id must be a non-negative integer" },
        { status: 400 }
      );
    }

    const project = await getStore().byIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const state = await getStore().state(project.path);
    const costUsd = state?.item_costs?.[taskId];
    const result = computeTaskDuration(state, taskId, costUsd);

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
