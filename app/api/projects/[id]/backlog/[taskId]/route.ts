// GET /api/projects/[id]/backlog/[taskId] — return full backlog item by ID
// PATCH /api/projects/[id]/backlog/[taskId] — update title, priority, and/or details
// DELETE /api/projects/[id]/backlog/[taskId] — remove a backlog item

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { readBacklog, readState } from "@/lib/redeye-files";
import fs from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string; taskId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, taskId } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [items, state] = await Promise.all([
    readBacklog(project.path),
    readState(project.path),
  ]);
  const item = items.find((i) => i.id === taskId);
  if (!item) {
    return NextResponse.json({ error: "Backlog item not found" }, { status: 404 });
  }

  // Enrich with cost_usd from state.item_costs if present
  const cost = state?.item_costs?.[taskId];
  const enriched = cost !== undefined ? { ...item, cost_usd: cost } : item;

  return NextResponse.json({ data: enriched });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, taskId } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, priority, details } = body as {
      title?: string;
      priority?: string;
      details?: string;
    };

  const projectResolved = path.resolve(project.path);
  const backlogPath = path.resolve(projectResolved, ".redeye", "backlog.md");

  if (!backlogPath.startsWith(projectResolved + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let content: string;
  try {
    content = await fs.readFile(backlogPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Backlog file not found" }, { status: 404 });
    }
    throw err;
  }

  // Verify the item exists
  const items = await readBacklog(project.path);
  const item = items.find((i) => i.id === taskId);
  if (!item) {
    return NextResponse.json({ error: "Backlog item not found" }, { status: 404 });
  }

  const escapedId = taskId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

  // Update title in the ### header line
  if (title !== undefined && title.trim()) {
    const titleRegex = new RegExp(`(### ${escapedId}:)([^\\n]*)`, "g");
    content = content.replace(titleRegex, `$1 ${title.trim()}`);
  }

  // Update **Priority:** field
  if (priority !== undefined) {
    if (priority.trim()) {
      // Replace existing priority field or add after the header
      const priorityFieldRegex = new RegExp(
        `(### ${escapedId}:[^\\n]*\\n(?:.*\\n)*?)(- \\*\\*Priority:\\*\\* [^\\n]+)`,
        "m"
      );
      if (priorityFieldRegex.test(content)) {
        content = content.replace(
          new RegExp(`(### ${escapedId}:[^\\n]*(?:\\n(?!###)[^\\n]*)*)` +
            `(- \\*\\*Priority:\\*\\* )[^\\n]+`, "m"),
          `$1$2${priority.trim()}`
        );
      }
    }
  }

  // Update **Details:** section (replace bullet list under Details)
  if (details !== undefined) {
    const detailsSectionRegex = new RegExp(
      `(### ${escapedId}:[^\\n]*(?:\\n(?!###)[^\\n]*)*?- \\*\\*Details:\\*\\*[ \\t]*\\n)` +
        `((?:[ \\t]*- [^\\n]*\\n?)*)`,
      "m"
    );
    if (details.trim()) {
      const newDetailLines = details
        .split("\n")
        .map((l) => (l.startsWith("  ") ? l : `  ${l}`))
        .join("\n");
      if (detailsSectionRegex.test(content)) {
        content = content.replace(detailsSectionRegex, `$1${newDetailLines}\n`);
      }
    }
  }

  await fs.writeFile(backlogPath, content, "utf-8");

  // Return the updated item, enriched with cost_usd from state if present
  const [updatedItems, state] = await Promise.all([
    readBacklog(project.path),
    readState(project.path),
  ]);
  const updatedItem = updatedItems.find((i) => i.id === taskId) ?? item;
  const cost = state?.item_costs?.[taskId];
  const enrichedUpdated = cost !== undefined ? { ...updatedItem, cost_usd: cost } : updatedItem;

    return NextResponse.json({ data: enrichedUpdated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update backlog item" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id, taskId } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

  // Read and rewrite backlog.md, removing the item block for taskId
  const projectResolved = path.resolve(project.path);
  const backlogPath = path.resolve(projectResolved, ".redeye", "backlog.md");

  // Guard against path traversal
  if (!backlogPath.startsWith(projectResolved + path.sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let content: string;
  try {
    content = await fs.readFile(backlogPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Backlog file not found" }, { status: 404 });
    }
    throw err;
  }

  // Remove the ### BL-XXX: ... block (up to, but not including, the next ###)
  const escapedId = taskId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const blockRegex = new RegExp(
    `\\n### ${escapedId}:[^\\n]*(?:\\n(?!###)[^\\n]*)*`,
    "g"
  );
  const updated = content.replace(blockRegex, "");

  if (updated === content) {
    return NextResponse.json({ error: "Backlog item not found" }, { status: 404 });
  }

    await fs.writeFile(backlogPath, updated, "utf-8");

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete backlog item" },
      { status: 500 }
    );
  }
}
