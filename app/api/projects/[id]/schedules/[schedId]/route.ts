// DELETE /api/projects/[id]/schedules/[schedId]
// Removes a SCHED-{N} block from .redeye/schedules.md.
// Returns { data: { success: true, deleted: schedId } }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { parseProjectIndex } from "@/lib/projects";
import { getStore } from "@/lib/app";
import { applyScheduleDelete } from "@/lib/redeye-parsers";
import { safeRedeyePath } from "@/lib/redeye-files";
import { commitAndPush } from "@/lib/git-commit-push";
import { atomicWriteJson } from "@/lib/atomic-write";

const SCHED_ID_RE = /^SCHED-\d+$/i;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; schedId: string }> }
): Promise<NextResponse> {
  try {
    const { id, schedId } = await params;

    // Validate schedId format
    if (!SCHED_ID_RE.test(schedId)) {
      return NextResponse.json(
        { error: `Invalid schedule id: ${schedId}` },
        { status: 400 }
      );
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

    const filePath = safeRedeyePath(project.path, "schedules.md");

    // Read the file
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "schedules.md not found" },
          { status: 404 }
        );
      }
      throw err;
    }

    // Apply the deletion
    let updated: string;
    try {
      updated = applyScheduleDelete(content, schedId);
    } catch (err) {
      if (err instanceof RangeError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }

    // Write atomically via shared library helper (unique tempfile + rename)
    await atomicWriteJson(filePath, updated);

    // Best-effort commit (push is the user's job)
    await commitAndPush(
      project.path,
      [".redeye/schedules.md"],
      `ceo: delete schedule ${schedId} (via dashboard)`
    );

    return NextResponse.json({ data: { success: true, deleted: schedId } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
