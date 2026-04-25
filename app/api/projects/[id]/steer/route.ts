import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { readSteering, safeRedeyePath } from "@/lib/redeye-files";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import fs from "fs/promises";

const MAX_BODY_BYTES = 64 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const directives = await readSteering(project.path);
    return NextResponse.json({ data: { directives } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read directives" },
      { status: 500 }
    );
  }
}

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

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;
    const directiveRaw: unknown = body?.directive;
    if (typeof directiveRaw !== "string" || directiveRaw.length === 0) {
      return NextResponse.json({ error: "Missing required field: directive" }, { status: 400 });
    }
    const directive = sanitizeMarkdownInput(directiveRaw, { maxLen: 500 });
    if (directive.length === 0) {
      return NextResponse.json({ error: "Directive empty after sanitization" }, { status: 400 });
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      content = "# Steering\n\n## Directives\n";
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const newDirective = `- ${directive} (${timestamp})\n`;

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
      { error: err instanceof Error ? err.message : "Failed to add directive" },
      { status: 500 }
    );
  }
}
