import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { getNextTaskId } from "@/lib/task-id";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { safeRedeyePath } from "@/lib/redeye-files";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import { commitAndPush } from "@/lib/git-commit-push";
import { appendCeoTask } from "@/lib/tasks-writer";
import { atomicWriteJson } from "@/lib/atomic-write";
import { withProjectLock } from "@/lib/state-mutex";
import * as logger from "@/lib/logger";
import fs from "fs/promises";

const MAX_BODY_BYTES = 64 * 1024;

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

    const priorityRaw: unknown = body?.priority;
    let priority = "P1";
    if (priorityRaw !== undefined && priorityRaw !== null && priorityRaw !== "") {
      if (typeof priorityRaw !== "string" || !/^P[012]$/.test(priorityRaw)) {
        return NextResponse.json({ error: "priority must be P0, P1, or P2" }, { status: 400 });
      }
      priority = priorityRaw;
    }

    const descriptionRaw: unknown = body?.description;
    let description = "";
    if (typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0) {
      description = sanitizeMarkdownInput(descriptionRaw, { maxLen: 2000 });
    }

    const tasksPath = safeRedeyePath(project.path, "tasks.md");

    // The whole id-allocation + read + append + write sequence must run
    // inside one withProjectLock so two concurrent POSTs can't both call
    // getNextTaskId, observe the same max id, allocate the same number,
    // and have one writer's append silently overwrite the other's.
    const itemId = await withProjectLock(project.path, async () => {
      const allocatedId = await getNextTaskId(project.path);
      let content: string;
      try {
        content = await fs.readFile(tasksPath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        content = "# Tasks\n\n## CEO Requests\n";
      }

      content = appendCeoTask(content, {
        id: allocatedId,
        title: text,
        type: "feature",
        priority,
        status: "pending",
        description: description || undefined,
      });

      await atomicWriteJson(tasksPath, content);
      return allocatedId;
    });

    // Commit so TRIAGE's CEO Requests sync-from-main doesn't drop
    // this item on the next iteration. Best-effort — push is the user's
    // job; the local commit alone is the durability boundary.
    const { committed } = await commitAndPush(
      project.path,
      [".redeye/tasks.md"],
      `ceo: add task item ${itemId} (via dashboard)`
    );

    let resumed = false;
    try {
      const session = getSessionStatus(project.path);
      if (session.cto.status === "stopped") {
        await startSession(project.path, "cto");
        resumed = true;
      }
    } catch (sessionErr) {
      logger.error("POST /tasks", "Failed to auto-resume CTO:", sessionErr);
    }

    return NextResponse.json({ data: { success: true, id: itemId, resumed, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add task" },
      { status: 500 }
    );
  }
}
