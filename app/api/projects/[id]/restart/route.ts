// POST /api/projects/[id]/restart — stop then start the CTO session
import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { stopSession, startSession } from "@/lib/session-manager";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  if (isNaN(index)) {
    return NextResponse.json({ error: "id must be a number" }, { status: 400 });
  }
  const project = await getProjectByIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  try {
    await stopSession(project.path, "cto");
    const sessionInfo = await startSession(project.path, "cto");
    return NextResponse.json({ data: sessionInfo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
