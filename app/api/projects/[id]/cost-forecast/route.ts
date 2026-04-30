// GET /api/projects/[id]/cost-forecast
// Returns { data: ForecastResult } where ForecastResult contains:
//   - sessions: per-session cost history (last 10, ascending mtime)
//   - burnRatePerSession: 7-session rolling average (or all if <7)
//   - trend: "accelerating" | "decelerating" | "stable"
//   - forecast24h / forecast7d: dollar projections at current burn rate
//   - sessionsPerDay: derived cadence
//   - projectedSessions: 5 forward points for chart projection
//
// Errors: 404 if project missing, 500 on unexpected exceptions.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { computeCostForecast } from "@/lib/cost-forecast";

export async function GET(
  _req: NextRequest,
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

    const forecast = await computeCostForecast(project.path);
    return NextResponse.json({ data: forecast });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
