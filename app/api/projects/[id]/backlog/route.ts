import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getNextBacklogId } from "@/lib/backlog-id";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { safeRedeyePath } from "@/lib/redeye-files";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import fs from "fs/promises";

const MAX_BODY_BYTES = 64 * 1024;

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

    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;
    const textRaw: unknown = body?.text;
    if (typeof textRaw !== "string" || textRaw.length === 0) {
      return NextResponse.json({ error: "Missing required field: text" }, { status: 400 });
    }
    const text = sanitizeMarkdownInput(textRaw, { maxLen: 500 });
    if (text.length === 0) {
      return NextResponse.json({ error: "Text empty after sanitization" }, { status: 400 });
    }

    const itemId = await getNextBacklogId(project.path);
    const backlogPath = safeRedeyePath(project.path, "backlog.md");
    let content: string;
    try {
      content = await fs.readFile(backlogPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      content = "# Backlog\n\n## CEO Requests\n";
    }

    const newItem = `\n### ${itemId}: ${text}\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n`;

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

    let resumed = false;
    try {
      const session = getSessionStatus(project.path);
      if (session.cto.status === "stopped") {
        await startSession(project.path, "cto");
        resumed = true;
      }
    } catch (sessionErr) {
      console.error("[POST /backlog] Failed to auto-resume CTO:", sessionErr);
    }

    return NextResponse.json({ data: { success: true, id: itemId, resumed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add backlog item" },
      { status: 500 }
    );
  }
}
