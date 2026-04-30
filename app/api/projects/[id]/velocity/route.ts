// GET /api/projects/[id]/velocity
// Returns { data: VelocityResult } where VelocityResult contains:
//   - weeks: 14 calendar weeks of {weekStart, count, rollingAvg, isCurrentWeek}
//   - avgTasksPerWeek: mean over complete (non-current) weeks
//   - trend: "up" | "down" | "stable"
//   - totalCompletedWithDate: count of done tasks with non-null mergedAt
//
// Errors: 400 if id is not a non-negative integer, 404 if project missing, 500 on unexpected exceptions.

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore } from "@/lib/app";
import { computeVelocity } from "@/lib/velocity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const tasks = await getStore().tasks(project.path);
    const result = computeVelocity(tasks);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
