import { NextRequest, NextResponse } from "next/server";
import os from "os";
import { listProjects, addProject } from "@/lib/projects";
import { isInitialized, readState, readInbox } from "@/lib/redeye-files";
import { getSessionStatus } from "@/lib/session-manager";
import { readJsonBody } from "@/lib/json-body";
import { tildify } from "@/lib/format-path";

// GET /api/projects — list all projects with status
export async function GET() {
  const projects = await listProjects();
  // Compute the host's home dir once per request and substitute it into
  // each project's path as `displayPath`. The raw `path` stays as-is for
  // any caller that needs a canonical filesystem reference (Add Project's
  // findIndex, the registered-path check, etc.).
  const home = os.homedir();
  const withStatus = await Promise.all(
    projects.map(async (p) => {
      const [initialized, state, inbox] = await Promise.all([
        isInitialized(p.path),
        readState(p.path),
        readInbox(p.path).catch(() => []),
      ]);
      const s = getSessionStatus(p.path).cto.status;
      const running = s === "running" || s === "stalled";
      return {
        ...p,
        displayPath: tildify(p.path, home),
        initialized,
        running,
        phase: state?.phase,
        currentTask: state?.task_title
          ? `${state.task_id ?? ""} ${state.task_title}`.trim()
          : null,
        questionCount: inbox.filter((q) => !q.answered).length,
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
