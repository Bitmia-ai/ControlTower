// GET /api/projects/[id]/session-history
// Returns { data: { sessions: SessionHistoryEntry[] } } sorted ascending by mtime.
// Optional ?limit=N query param (default 50) caps the number of returned sessions.
// The limit is clamped at MAX_LIMIT to prevent unbounded transcript fan-out: each
// returned session triggers a readline-stream over a multi-MB JSONL file, so a
// caller passing ?limit=999999 would otherwise stall the event loop while
// streaming up to 999,999 files.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { getSessionHistory } from "@/lib/cost-history";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
    const project = await getProjectByIndex(index);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const limitParam = req.nextUrl.searchParams.get("limit");
    let limit = DEFAULT_LIMIT;
    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    const sessions = await getSessionHistory(project.path, limit);
    return NextResponse.json({ data: { sessions } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
