import { NextRequest, NextResponse } from "next/server";
import { listProjects, addProject } from "@/lib/projects";
import { isInitialized, readState, readInbox } from "@/lib/redeye-files";
import { getSessionStatus } from "@/lib/session-manager";

// GET /api/projects — list all projects with status
export async function GET() {
  const projects = await listProjects();
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
        initialized,
        running,
        phase: state?.phase,
        currentTask: state?.backlog_title
          ? `${state.backlog_item ?? ""} ${state.backlog_title}`.trim()
          : null,
        questionCount: inbox.filter((q) => !q.answered).length,
      };
    })
  );
  return NextResponse.json({ data: withStatus });
}

// POST /api/projects — add a new project
export async function POST(req: NextRequest) {
  const { name, path } = await req.json();
  if (!name || !path) {
    return NextResponse.json({ error: "name and path required" }, { status: 400 });
  }
  try {
    await addProject(name, path);
    return NextResponse.json({ data: { name, path } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
