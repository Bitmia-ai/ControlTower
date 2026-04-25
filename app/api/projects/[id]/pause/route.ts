import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
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

    await fs.writeFile(steeringPath, content, "utf-8");

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to pause" },
      { status: 500 }
    );
  }
}
