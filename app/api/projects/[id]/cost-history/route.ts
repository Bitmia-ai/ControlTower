// GET /api/projects/[id]/cost-history
// Returns { data: { sessions: Array<{ file: string, cost: number, mtimeMs: number }> } }
// Sessions are sorted ascending by mtime, capped at the most-recent 10.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { getSessionCostHistory } from "@/lib/cost-history";

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
    const project = await getProjectByIndex(index);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sessions = await getSessionCostHistory(project.path);
    return NextResponse.json({ data: { sessions } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
