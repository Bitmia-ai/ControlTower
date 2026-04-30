// GET /api/projects/[id]/sessions — return session status for all roles
//
// Phase 1 of the Radio integration (see Radio/INTEGRATION.md): this
// route reads its dependencies through the abstraction layer
// (`getStore`, `getSessionDriver`) instead of importing the local
// modules directly. Behavior unchanged.

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getSessionDriver } from "@/lib/app";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const sessionStatus = getSessionDriver().status(project.path);
    return NextResponse.json({ data: sessionStatus });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
