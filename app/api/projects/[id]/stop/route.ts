// POST /api/projects/[id]/stop — writes a graceful STOP directive to .redeye/steering.md.
// Aligns with the `/redeye:stop` slash command: no process kill; CTO finishes current
// phase then exits at the next boundary. See docs/specs/T034-stop-pause-fix.md.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { commitAndPush } from "@/lib/git-commit-push";
import fs from "fs/promises";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        content = "";
      } else {
        throw err;
      }
    }

    const newDirective = `STOP — CEO directed stop at ${new Date().toISOString()}\n`;

    const directivesHeader = "## Directives";
    const idx = content.indexOf(directivesHeader);
    if (idx !== -1) {
      const afterHeader = idx + directivesHeader.length;
      const nextLine = content.indexOf("\n", afterHeader);
      content =
        content.slice(0, nextLine + 1) +
        "\n" +
        newDirective +
        content.slice(nextLine + 1);
    } else {
      const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n";
      content += `${prefix}\n## Directives\n\n${newDirective}`;
    }

    await fs.writeFile(steeringPath, content, "utf-8");

    // Commit + push so TRIAGE's sync-from-main doesn't wipe the STOP
    // directive on the next iteration. Best-effort.
    const { committed, pushed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: STOP directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed, pushed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
