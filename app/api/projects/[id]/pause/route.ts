import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { commitAndPush } from "@/lib/git-commit-push";
import { atomicWriteJson } from "@/lib/atomic-write";
import fs from "fs/promises";

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

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      content = "# Steering\n\n## Directives\n";
    }

    const newDirective = `PAUSE — CEO directed pause at ${new Date().toISOString()}\n`;

    const directivesHeader = "## Directives";
    const idx = content.indexOf(directivesHeader);
    if (idx !== -1) {
      const afterHeader = idx + directivesHeader.length;
      const nextLine = content.indexOf("\n", afterHeader);
      content = content.slice(0, nextLine + 1) + "\n" + newDirective + content.slice(nextLine + 1);
    } else {
      content += "\n## Directives\n\n" + newDirective;
    }

    await atomicWriteJson(steeringPath, content);

    // Commit so TRIAGE's sync-from-main doesn't wipe the PAUSE
    // directive on the next iteration. Best-effort — push is the
    // user's job; the local commit alone is the durability boundary.
    const { committed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: PAUSE directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to pause" },
      { status: 500 }
    );
  }
}
