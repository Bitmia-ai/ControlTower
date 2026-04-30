// POST /api/projects/[id]/restart — stop then start the CTO session
import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getSessionDriver } from "@/lib/app";

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
  const project = await getStore().byIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  try {
    const sessions = getSessionDriver();
    await sessions.stop(project.path, "cto");
    const sessionInfo = await sessions.start(project.path, "cto");
    return NextResponse.json({ data: sessionInfo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
