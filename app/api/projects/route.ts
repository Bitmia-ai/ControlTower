import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { listProjects, addProject } from "@/lib/projects";
import {
  isInitialized,
  readState,
  readInbox,
  readTasks,
  readArchivedTasks,
  safeRedeyePath,
} from "@/lib/redeye-files";
import { parseSchedules } from "@/lib/redeye-parsers";
import { getSessionStatus } from "@/lib/session-manager";
import { readJsonBody } from "@/lib/json-body";
import type { ProjectWithStatus } from "@/lib/redeye-types";

async function readScheduleSummary(
  projectPath: string
): Promise<{ enabled: boolean; summary: string | null }> {
  let content: string;
  try {
    content = await fs.readFile(safeRedeyePath(projectPath, "schedules.md"), "utf-8");
  } catch {
    return { enabled: false, summary: null };
  }
  const entries = parseSchedules(content);
  if (entries.length === 0) return { enabled: false, summary: null };
  // Use the first entry's frequency as the user-visible summary.
  // The card has limited width; a one-line frequency reads cleaner than a
  // count + comma list.
  const summary = entries[0]?.frequency ?? null;
  return { enabled: true, summary };
}

// GET /api/projects — list all projects with status
export async function GET() {
  const projects = await listProjects();
  const withStatus: ProjectWithStatus[] = await Promise.all(
    projects.map(async (p) => {
      const [initialized, state, inbox, tasks, archived, schedule] = await Promise.all([
        isInitialized(p.path),
        readState(p.path),
        readInbox(p.path).catch(() => []),
        readTasks(p.path).catch(() => []),
        // Archived (shipped & closed) tasks live in `.redeye/tasks-archive/`.
        // We need them to give an honest lifetime "Done" count on the project
        // card — `tasks.md` only retains the most recent N done items before
        // RedEye rolls them off into the archive.
        readArchivedTasks(p.path).catch(() => []),
        readScheduleSummary(p.path).catch(() => ({ enabled: false, summary: null })),
      ]);
      const s = getSessionStatus(p.path).cto.status;
      const running = s === "running" || s === "stalled";
      const taskId = state?.task_id ?? null;
      const taskTitle = state?.task_title ?? null;
      const backlogCount = tasks.filter(
        (t) => t.status !== "done" && t.status !== "wontdo"
      ).length;
      // Lifetime done = live "done" rows + archived rows. Dedupe by id so an
      // item that's still in tasks.md but also got copied into the archive
      // (during a partial archive run) isn't counted twice.
      const doneIds = new Set<string>();
      for (const t of tasks) if (t.status === "done") doneIds.add(t.id);
      for (const t of archived) if (t.status === "done") doneIds.add(t.id);
      const doneCount = doneIds.size;
      return {
        ...p,
        initialized,
        running,
        phase: state?.phase,
        currentTask: taskTitle ? `${taskId ?? ""} ${taskTitle}`.trim() : null,
        taskId,
        taskTitle,
        questionCount: inbox.filter((q) => !q.answered).length,
        backlogCount,
        doneCount,
        scheduleEnabled: schedule.enabled,
        scheduleSummary: schedule.summary,
      };
    })
  );
  return NextResponse.json({ data: withStatus });
}

// POST /api/projects — add a new project
export async function POST(req: NextRequest) {
  const body = await readJsonBody<{ name?: unknown; path?: unknown }>(req, 1024);
  if (!body.ok) return body.response;
  const { name, path } = body.data;
  if (!name || !path || typeof name !== "string" || typeof path !== "string") {
    return NextResponse.json({ error: "name and path required" }, { status: 400 });
  }
  try {
    // Return the canonical (realpath-resolved) registered path so callers
    // — like the Add Project dialog's findIndex — match it correctly.
    const registered = await addProject(name, path);
    return NextResponse.json({ data: registered }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
