// POST /api/projects/[id]/schedules/run
// Marks a schedule as overdue (sets Last run to a stale timestamp) so the
// next TRIAGE picks it up and routes to SCHEDULES. Avoids polluting
// steering.md with permanent RUN_SCHEDULE directives.
//
// In addition (T125), inserts a pending task entry into tasks.md so the
// queued run is immediately visible in the Tasks tab and the Up Next card
// on mission control. The CTO's TRIAGE phase treats this entry like any
// other P1 backlog item.

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getSessionDriver } from "@/lib/app";
import { safeRedeyePath } from "@/lib/redeye-files";
import { readJsonBody } from "@/lib/json-body";
import { getNextTaskId } from "@/lib/task-id";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { appendCeoTask } from "@/lib/tasks-writer";
import { atomicWriteJson } from "@/lib/atomic-write";
import { withProjectLock } from "@/lib/state-mutex";
import { commitAndPush } from "@/lib/git-commit-push";
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
    const tasksPath = safeRedeyePath(project.path, "tasks.md");

    // Both writes (schedules.md + tasks.md) plus the read+title-extraction
    // happen inside a single withProjectLock block so concurrent runs of
    // /schedules/run can't race on either file. The taskId allocation is
    // also inside the lock so two concurrent runs can't claim the same id.
    let result:
      | { kind: "ok"; taskId: string }
      | { kind: "schedules-missing" }
      | { kind: "schedule-not-found" };
    result = await withProjectLock(project.path, async () => {
      let content: string;
      try {
        content = await fs.readFile(schedulesPath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return { kind: "schedules-missing" } as const;
        }
        throw err;
      }

      // Locate the SCHED-{id} block. A block runs from `### SCHED-{id}` to
      // the next `### ` heading or EOF. Match case-insensitively to mirror
      // the id validator's tolerance.
      const blockRegex = new RegExp(
        `### ${scheduleId}[^\\n]*(?:\\n(?!### )[^\\n]*)*`,
        "i"
      );
      const blockMatch = content.match(blockRegex);
      if (!blockMatch) {
        return { kind: "schedule-not-found" } as const;
      }

      const block = blockMatch[0];

      // Extract the schedule title from the heading line so we can echo it
      // into the pending task entry. Fall back to the scheduleId if the
      // block has no title text after the id.
      const titleMatch = block.match(/### SCHED-\d+:\s*([^\n]+)/i);
      const rawTitle = titleMatch?.[1]?.trim();
      const scheduleTitle =
        rawTitle && rawTitle.length > 0
          ? sanitizeMarkdownInput(rawTitle, { maxLen: 100 })
          : scheduleId;

      const lastRunLine = `- **Last run:** ${STALE_TIMESTAMP}`;
      let updatedBlock: string;
      if (/- \*\*Last run:\*\* [^\n]*/i.test(block)) {
        updatedBlock = block.replace(/- \*\*Last run:\*\* [^\n]*/i, lastRunLine);
      } else {
        // Schedule entry without a Last run line — append one.
        updatedBlock = `${block.trimEnd()}\n${lastRunLine}`;
      }
      const updated = content.replace(blockRegex, updatedBlock);

      await atomicWriteJson(schedulesPath, updated);

      // ---------------------------------------------------------------
      // T125: write a pending task into tasks.md so the queued run is
      // visible in the Tasks tab and Up Next card immediately.
      // ---------------------------------------------------------------
      const taskId = await getNextTaskId(project.path);
      let tasksContent: string;
      try {
        tasksContent = await fs.readFile(tasksPath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        tasksContent = "# Tasks\n\n## CEO Requests\n";
      }

      tasksContent = appendCeoTask(tasksContent, {
        id: taskId,
        title: `Run schedule: ${scheduleTitle}`,
        type: "scheduled",
        priority: "P1",
        status: "pending",
        schedule: scheduleId,
      });

      await atomicWriteJson(tasksPath, tasksContent);

      // Commit so TRIAGE's sync-from-main on the next iteration doesn't
      // wipe either the queued schedule run (schedules.md) or the pending
      // task entry (tasks.md). Best-effort — never fail the request just
      // because git is unhappy. Push is the user's job; the local commit
      // alone is the durability boundary. This is the only mutating route
      // under .redeye/* that previously skipped the commit, so the file
      // change would have been lost on the next TRIAGE sync.
      await commitAndPush(
        project.path,
        [".redeye/schedules.md", ".redeye/tasks.md"],
        `ceo: queue schedule ${scheduleId} (via dashboard)`
      );

      return { kind: "ok", taskId } as const;
    });

    if (result.kind === "schedules-missing") {
      return NextResponse.json(
        { error: "schedules.md not found — no schedules defined" },
        { status: 404 }
      );
    }
    if (result.kind === "schedule-not-found") {
      return NextResponse.json(
        { error: `${scheduleId} not found in schedules.md` },
        { status: 404 }
      );
    }

    // Auto-start the CTO session if it's not running so TRIAGE picks up the
    // now-overdue schedule on its next pass.
    const status = getSessionDriver().status(project.path);
    let resumed = false;
    if (status.cto.status !== "running") {
      await getSessionDriver().start(project.path, "cto");
      resumed = true;
    }

    return NextResponse.json({
      data: { queued: true, scheduleId, resumed, taskId: result.taskId },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
