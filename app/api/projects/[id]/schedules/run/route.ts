// POST /api/projects/[id]/schedules/run
// Marks a schedule as overdue (sets Last run to a stale timestamp) so the
// next TRIAGE picks it up and routes to SCHEDULES. Avoids polluting
// steering.md with permanent RUN_SCHEDULE directives.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { safeRedeyePath } from "@/lib/redeye-files";
import { readJsonBody } from "@/lib/json-body";
import fs from "fs/promises";

const SCHEDULE_ID_RE = /^SCHED-\d+$/i;
const MAX_BODY_BYTES = 1024;
// Far enough in the past that any positive frequency makes the schedule
// overdue. SCHEDULES will overwrite this with the real timestamp on its
// next run, so the stale value is self-cleaning.
const STALE_TIMESTAMP = "1970-01-01T00:00:00Z";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const scheduleId = r.data?.scheduleId;
    if (typeof scheduleId !== "string" || scheduleId.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: scheduleId" },
        { status: 400 }
      );
    }
    if (!SCHEDULE_ID_RE.test(scheduleId)) {
      return NextResponse.json(
        { error: "scheduleId must match SCHED-<number>" },
        { status: 400 }
      );
    }

    const schedulesPath = safeRedeyePath(project.path, "schedules.md");
    let content: string;
    try {
      content = await fs.readFile(schedulesPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "schedules.md not found — no schedules defined" },
          { status: 404 }
        );
      }
      throw err;
    }

    // Locate the SCHED-{id} block. A block runs from `### SCHED-{id}` to the
    // next `### ` heading or EOF. Match case-insensitively to mirror the id
    // validator's tolerance.
    const blockRegex = new RegExp(
      `### ${scheduleId}[^\\n]*(?:\\n(?!### )[^\\n]*)*`,
      "i"
    );
    const blockMatch = content.match(blockRegex);
    if (!blockMatch) {
      return NextResponse.json(
        { error: `${scheduleId} not found in schedules.md` },
        { status: 404 }
      );
    }

    const block = blockMatch[0];
    const lastRunLine = `- **Last run:** ${STALE_TIMESTAMP}`;
    let updatedBlock: string;
    if (/- \*\*Last run:\*\* [^\n]*/i.test(block)) {
      updatedBlock = block.replace(/- \*\*Last run:\*\* [^\n]*/i, lastRunLine);
    } else {
      // Schedule entry without a Last run line — append one.
      updatedBlock = `${block.trimEnd()}\n${lastRunLine}`;
    }
    const updated = content.replace(blockRegex, updatedBlock);

    await fs.writeFile(schedulesPath, updated, "utf-8");

    // Auto-start the CTO session if it's not running so TRIAGE picks up the
    // now-overdue schedule on its next pass.
    const status = getSessionStatus(project.path);
    let resumed = false;
    if (status.cto.status !== "running") {
      await startSession(project.path, "cto");
      resumed = true;
    }

    return NextResponse.json({ data: { queued: true, scheduleId, resumed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
