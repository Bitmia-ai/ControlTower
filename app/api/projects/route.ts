import { NextRequest, NextResponse } from "next/server";
import { getStore, getSessionDriver } from "@/lib/app";
import { readJsonBody } from "@/lib/json-body";

// GET /api/projects — list all projects with status
export async function GET() {
  const store = getStore();
  const sessions = getSessionDriver();
  const projects = await store.list();
  const withStatus = await Promise.all(
    projects.map(async (p) => {
      const [initialized, state, inbox] = await Promise.all([
        store.isInitialized(p.path),
        store.state(p.path),
        store.inbox(p.path).catch(() => []),
      ]);
      const s = sessions.status(p.path).cto.status;
      const running = s === "running" || s === "stalled";
      return {
        ...p,
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
    const registered = await getStore().add(name, path);
    return NextResponse.json({ data: registered }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
