// DELETE /api/projects/[id]/schedules/[schedId]
// Removes a SCHED-{N} block from .redeye/schedules.md.
// Returns { data: { success: true, deleted: schedId } }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getProjectByIndex } from "@/lib/projects";
import { applyScheduleDelete } from "@/lib/redeye-parsers";
import { commitAndPush } from "@/lib/git-commit-push";

const SCHED_ID_RE = /^SCHED-\d+$/i;

function schedulesPath(projectPath: string): string {
  const projectResolved = path.resolve(projectPath);
  const filePath = path.resolve(projectResolved, ".redeye", "schedules.md");

  // Reject path traversal
  if (!filePath.startsWith(projectResolved + path.sep)) {
    throw new Error("Path traversal detected");
  }
  return filePath;
}

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

    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const filePath = schedulesPath(project.path);

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

    // Write atomically: write to temp file, then rename
    const tmpPath = filePath + ".tmp";
    await fs.writeFile(tmpPath, updated, "utf-8");
    await fs.rename(tmpPath, filePath);

    // Best-effort commit + push
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
