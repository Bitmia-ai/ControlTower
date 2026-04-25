// POST /api/projects/[id]/schedules/run
// Writes a RUN_SCHEDULE steering directive and auto-starts the CTO if stopped.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { safeRedeyePath } from "@/lib/redeye-files";
import fs from "fs/promises";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const scheduleId: unknown = body?.scheduleId;
    if (!scheduleId || typeof scheduleId !== "string") {
      return NextResponse.json(
        { error: "Missing required field: scheduleId" },
        { status: 400 }
      );
    }

    // Validate scheduleId format to prevent injection
    if (!/^SCHED-\d+$/i.test(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid scheduleId format" },
        { status: 400 }
      );
    }

    // Append steering directive
    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch {
      content = "# Steering\n\n## Directives\n\n";
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const directive = `- RUN_SCHEDULE: ${scheduleId} (${timestamp})\n`;

    const directivesHeader = "## Directives";
    const idx = content.indexOf(directivesHeader);
    if (idx !== -1) {
      const afterHeader = idx + directivesHeader.length;
      const nextLine = content.indexOf("\n", afterHeader);
      content =
        content.slice(0, nextLine + 1) +
        "\n" +
        directive +
        content.slice(nextLine + 1);
    } else {
      content += "\n## Directives\n\n" + directive;
    }
    await fs.writeFile(steeringPath, content, "utf-8");

    // Auto-start the CTO session if it's not running
    const status = getSessionStatus(project.path);
    if (status.cto.status !== "running") {
      await startSession(project.path, "cto");
    }

    return NextResponse.json({ data: { queued: true, scheduleId } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
