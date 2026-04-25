import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { readSteering, safeRedeyePath } from "@/lib/redeye-files";
import { applyDirectiveEdit, applyDirectiveDelete } from "@/lib/redeye-parsers";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import { commitAndPush } from "@/lib/git-commit-push";
import fs from "fs/promises";

const MAX_BODY_BYTES = 64 * 1024;
// Edit/delete payloads are tiny ({index} or {index, text}); cap aggressively.
const MAX_MUTATE_BODY_BYTES = 4 * 1024;

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

    // Commit + push so TRIAGE's sync-from-main doesn't wipe this on the
    // next iteration. Best-effort — never fail the request just because
    // git is unhappy; the file is still on disk for now.
    const { committed, pushed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: add steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed, pushed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add directive" },
      { status: 500 }
    );
  }
}

function parseIndex(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectIndex = parseInt(id, 10);
  const project = await getProjectByIndex(projectIndex);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_MUTATE_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    const index = parseIndex(body?.index);
    if (index === null) {
      return NextResponse.json(
        { error: "Missing or invalid field: index (must be a non-negative integer)" },
        { status: 400 }
      );
    }
    const textRaw: unknown = body?.text;
    if (typeof textRaw !== "string" || textRaw.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 }
      );
    }
    const text = sanitizeMarkdownInput(textRaw, { maxLen: 500 });
    if (text.length === 0) {
      return NextResponse.json(
        { error: "Directive empty after sanitization" },
        { status: 400 }
      );
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "directive index out of range" },
          { status: 404 }
        );
      }
      throw err;
    }

    let updated: string;
    try {
      updated = applyDirectiveEdit(content, index, text);
    } catch (err) {
      if (err instanceof RangeError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }

    await fs.writeFile(steeringPath, updated, "utf-8");

    const { committed, pushed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: edit steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed, pushed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to edit directive" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectIndex = parseInt(id, 10);
  const project = await getProjectByIndex(projectIndex);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_MUTATE_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    const index = parseIndex(body?.index);
    if (index === null) {
      return NextResponse.json(
        { error: "Missing or invalid field: index (must be a non-negative integer)" },
        { status: 400 }
      );
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "directive index out of range" },
          { status: 404 }
        );
      }
      throw err;
    }

    let updated: string;
    try {
      updated = applyDirectiveDelete(content, index);
    } catch (err) {
      if (err instanceof RangeError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }

    await fs.writeFile(steeringPath, updated, "utf-8");

    const { committed, pushed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: delete steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed, pushed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete directive" },
      { status: 500 }
    );
  }
}
