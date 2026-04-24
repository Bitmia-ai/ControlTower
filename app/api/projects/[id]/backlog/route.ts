import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getNextBacklogId } from "@/lib/backlog-id";
import fs from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const text: string = body?.text;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing required field: text" }, { status: 400 });
  }

  try {
    const itemId = await getNextBacklogId(project.path);
    const backlogPath = path.join(project.path, ".redeye", "backlog.md");
    let content = await fs.readFile(backlogPath, "utf-8");

    const newItem = `\n### ${itemId}: ${text.trim()}\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n`;

    // Insert after ## CEO Requests header
    const ceoHeader = "## CEO Requests";
    const ceoIdx = content.indexOf(ceoHeader);
    if (ceoIdx !== -1) {
      const insertAt = ceoIdx + ceoHeader.length;
      const nextLine = content.indexOf("\n", insertAt);
      content = content.slice(0, nextLine + 1) + newItem + content.slice(nextLine + 1);
    } else {
      content += "\n" + newItem;
    }

    await fs.writeFile(backlogPath, content, "utf-8");

    return NextResponse.json({ data: { success: true, id: itemId } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add backlog item" },
      { status: 500 }
    );
  }
}
