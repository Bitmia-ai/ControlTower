// GET /api/projects/[id]/schedules
// Returns { data: { schedules: ScheduleEntry[] } }
// Reads .redeye/schedules.md and parses all SCHED-{id} blocks.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getProjectByIndex } from "@/lib/projects";
import { parseSchedules } from "@/lib/redeye-parsers";
import type { ScheduleEntry } from "@/lib/redeye-types";

async function readSchedulesMd(projectPath: string): Promise<string | null> {
  const projectResolved = path.resolve(projectPath);
  const filePath = path.resolve(projectResolved, ".redeye", "schedules.md");

  // Reject path traversal
  if (!filePath.startsWith(projectResolved + path.sep)) {
    throw new Error("Path traversal detected");
  }

  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ data: { schedules: ScheduleEntry[] } } | { error: string }>> {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const content = await readSchedulesMd(project.path);
    const schedules = content ? parseSchedules(content) : [];

    return NextResponse.json({ data: { schedules } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
