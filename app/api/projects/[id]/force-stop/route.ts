// POST /api/projects/[id]/force-stop — hard-kills the CTO session.
// Unlike graceful /stop (which writes a STOP directive and waits for the
// next phase boundary), this calls stopSession() which sends SIGTERM and
// falls back to SIGKILL after 10s. Use when the session is hung or
// unresponsive. See docs/specs/T037-force-stop.md.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { stopSession } from "@/lib/session-manager";

export async function POST(
  req: NextRequest,
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

    await stopSession(project.path, "cto");

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
