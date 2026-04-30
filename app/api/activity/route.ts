import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";
import { readChangelog } from "@/lib/redeye-files";

export interface FleetActivityEntry {
  /** Stable id: `${projectIndex}:${index-in-project-changelog}` */
  uid: string;
  projectIndex: number;
  projectName: string;
  title: string;
  details: string;
  date: string | null;
}

const FLEET_LIMIT = 60;

/**
 * GET /api/activity — fleet-wide shipped/changelog feed for the global
 * activity page. Aggregates the (live) CHANGELOG.md from every registered
 * project, sorts by date descending, and caps at FLEET_LIMIT entries so the
 * client never receives an unbounded payload.
 */
export async function GET() {
  const projects = await listProjects();
  const all: FleetActivityEntry[] = [];

  await Promise.all(
    projects.map(async (p, projectIndex) => {
      const entries = await readChangelog(p.path).catch(() => []);
      entries.forEach((e, i) => {
        all.push({
          uid: `${projectIndex}:${i}`,
          projectIndex,
          projectName: p.name,
          title: e.title,
          details: e.details,
          date: e.date ?? null,
        });
      });
    })
  );

  // Sort newest-first. Entries without a parseable date sink to the bottom.
  all.sort((a, b) => {
    const ax = a.date ? Date.parse(a.date) : 0;
    const bx = b.date ? Date.parse(b.date) : 0;
    return bx - ax;
  });

  return NextResponse.json({ data: all.slice(0, FLEET_LIMIT) });
}
