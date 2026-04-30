// GET /api/projects/[id] — project detail
// DELETE /api/projects/[id] — remove a project from Control Tower
// [id] is the index in the projects array

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getSessionDriver, getTranscriptSource } from "@/lib/app";

// T013: the Live tab polls /transcript-status for its gating decision, but
// this detail endpoint also exposes `hasTranscript` as a convenience for
// home-page cards and other consumers that don't want a second round-trip.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseProjectIndex(id);
  if (index === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const store = getStore();
  const project = await store.byIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const sessionStatus = getSessionDriver().status(project.path);
    const initialized = await store.isInitialized(project.path);
    // T013: hasTranscript lets the Live tab connect to the SSE stream
    // whenever a recent transcript file exists, independent of whether the
    // session was spawned by Control Tower (`running`) or the user's CLI.
    const hasTranscript = getTranscriptSource().resolve(project.path) !== null;
    const projectWithStatus = {
      ...project,
      initialized,
      running: sessionStatus.cto.status === "running" || sessionStatus.cto.status === "stalled",
      hasTranscript,
      sessionStatus,
    };

    const detail = await store.detail(project.path, projectWithStatus);

    return NextResponse.json({
      data: {
        ...detail,
        project: {
          ...detail.project,
          sessionStatus,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseProjectIndex(id);
  if (index === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const store = getStore();
  const project = await store.byIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    await store.remove(project.path);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
