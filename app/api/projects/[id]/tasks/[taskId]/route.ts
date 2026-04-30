// GET /api/projects/[id]/tasks/[taskId] — return full task by ID
// PATCH /api/projects/[id]/tasks/[taskId] — update title, priority, description, and/or details
// DELETE /api/projects/[id]/tasks/[taskId] — remove a task

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { safeRedeyePath, readArchivedTasks } from "@/lib/redeye-files";
import { getStore } from "@/lib/app";
import { readJsonBody } from "@/lib/json-body";
import { TASK_ID_RE } from "@/lib/task-id";
import { sanitizeMarkdownInput, sanitizeMarkdownBlock } from "@/lib/markdown-sanitize";
import { atomicWriteJson } from "@/lib/atomic-write";
import fs from "fs/promises";

type Params = { params: Promise<{ id: string; taskId: string }> };

const MAX_BODY_BYTES = 64 * 1024;

export async function GET(req: NextRequest, { params }: Params) {
  const { id, taskId } = await params;
  if (!TASK_ID_RE.test(taskId)) {
    return NextResponse.json({ error: "taskId must match T<number>" }, { status: 400 });
  }
  const index = parseProjectIndex(id);
  if (index === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const project = await getStore().byIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [activeItems, state] = await Promise.all([
    getStore().tasks(project.path),
    getStore().state(project.path),
  ]);
  let item = activeItems.find((i) => i.id === taskId);
  // Fall back to the archive — RedEye removes done tasks from tasks.md
  // entirely after MERGE; their bodies live in docs/tasks-archive/YYYY-MM.md.
  if (!item) {
    const archived = await readArchivedTasks(project.path);
    item = archived.find((i) => i.id === taskId);
  }
  if (!item) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Enrich with cost_usd from state.item_costs if present
  const cost = state?.item_costs?.[taskId];
  const enriched = cost !== undefined ? { ...item, cost_usd: cost } : item;

  return NextResponse.json({ data: enriched });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id, taskId } = await params;
    if (!TASK_ID_RE.test(taskId)) {
      return NextResponse.json({ error: "taskId must match T<number>" }, { status: 400 });
    }
    const index = parseProjectIndex(id);
    if (index === null) {
      return NextResponse.json(
        { error: "id must be a non-negative integer" },
        { status: 400 }
      );
    }
    const project = await getStore().byIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    let { title, priority, details, description } = r.data as {
      title?: string;
      priority?: string;
      details?: string;
      description?: string;
    };

    // Sanitize all user inputs before writing to markdown.
    // This is the trust boundary where the CTO agent reads these files as instructions.
    if (title) title = sanitizeMarkdownInput(title, { maxLen: 200 });
    if (priority) priority = sanitizeMarkdownInput(priority, { maxLen: 100 });
    if (description) description = sanitizeMarkdownBlock(description, { maxLen: 16384 });
    if (details) details = sanitizeMarkdownBlock(details, { maxLen: 16384 });

  const tasksPath = safeRedeyePath(project.path, "tasks.md");

  let content: string;
  try {
    content = await fs.readFile(tasksPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Tasks file not found" }, { status: 404 });
    }
    throw err;
  }

  // Verify the item exists
  const items = await getStore().tasks(project.path);
  const item = items.find((i) => i.id === taskId);
  if (!item) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
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

  // Update **Description:** field (multi-line markdown value).
  // Mirrors how `pickMultilineField` reads it in lib/redeye-parsers.ts:
  // value continues from `- **Description:**` marker until the next
  // `- **AnyField:**` line or `### ` heading.
  if (description !== undefined) {
    const trimmedDescription = description.trim();
    // Locate the task block boundaries: from `### TASKID:` to next `### ` or EOF.
    const blockBoundaryRe = new RegExp(
      `(### ${escapedId}:[^\\n]*\\n)((?:(?!### )[\\s\\S])*)`,
      "m"
    );
    const blockMatch = content.match(blockBoundaryRe);
    if (blockMatch) {
      const headerLine = blockMatch[1];
      const blockBody = blockMatch[2];

      // Look for an existing `- **Description:**` line in the block body
      const descRe = /(^|\n)- \*\*Description:\*\*[ \t]*([^\n]*)((?:\n(?!- \*\*|### )[^\n]*)*)/;
      const descMatch = blockBody.match(descRe);

      let newBlockBody: string;
      if (descMatch) {
        // Replace existing Description field
        if (trimmedDescription) {
          const replacement = `${descMatch[1]}- **Description:** ${trimmedDescription}`;
          newBlockBody = blockBody.replace(descRe, replacement);
        } else {
          // Empty description → remove the description line entirely
          // Use the leading newline (if any) consumed by the match
          newBlockBody = blockBody.replace(descRe, descMatch[1] === "\n" ? "" : "");
        }
      } else if (trimmedDescription) {
        // Insert `- **Description:**` line right after the header line.
        // Preserve any leading content as-is.
        newBlockBody = `- **Description:** ${trimmedDescription}\n${blockBody}`;
      } else {
        // Nothing to add or remove
        newBlockBody = blockBody;
      }

      content = content.replace(blockBoundaryRe, `${headerLine}${newBlockBody}`);
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

  await atomicWriteJson(tasksPath, content);

  // Return the updated item, enriched with cost_usd from state if present
  const [updatedItems, state] = await Promise.all([
    getStore().tasks(project.path),
    getStore().state(project.path),
  ]);
  const updatedItem = updatedItems.find((i) => i.id === taskId) ?? item;
  const cost = state?.item_costs?.[taskId];
  const enrichedUpdated = cost !== undefined ? { ...updatedItem, cost_usd: cost } : updatedItem;

    return NextResponse.json({ data: enrichedUpdated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id, taskId } = await params;
    if (!TASK_ID_RE.test(taskId)) {
      return NextResponse.json({ error: "taskId must match T<number>" }, { status: 400 });
    }
    const index = parseProjectIndex(id);
    if (index === null) {
      return NextResponse.json(
        { error: "id must be a non-negative integer" },
        { status: 400 }
      );
    }
    const project = await getStore().byIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

  const tasksPath = safeRedeyePath(project.path, "tasks.md");

  let content: string;
  try {
    content = await fs.readFile(tasksPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Tasks file not found" }, { status: 404 });
    }
    throw err;
  }

  // Remove the ### TXXX: ... block (up to, but not including, the next ###)
  const escapedId = taskId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const blockRegex = new RegExp(
    `\\n### ${escapedId}:[^\\n]*(?:\\n(?!###)[^\\n]*)*`,
    "g"
  );
  const updated = content.replace(blockRegex, "");

  if (updated === content) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

    await atomicWriteJson(tasksPath, updated);

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete task" },
      { status: 500 }
    );
  }
}
