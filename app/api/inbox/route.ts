import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";
import { readInbox } from "@/lib/redeye-files";
import type { InboxQuestion } from "@/lib/redeye-types";

export interface FleetInboxQuestion {
  /** Stable cross-project id. Format: `${projectIndex}:${questionId}`. */
  uid: string;
  projectIndex: number;
  projectName: string;
  projectPath: string;
  question: InboxQuestion;
}

/**
 * GET /api/inbox — aggregate every unanswered question across the registered
 * fleet so the home dashboard can render a single inbox card without making
 * N round-trips for each project's inbox file.
 */
export async function GET() {
  const projects = await listProjects();
  const all: FleetInboxQuestion[] = [];
  await Promise.all(
    projects.map(async (p, projectIndex) => {
      const inbox = await readInbox(p.path).catch(() => [] as InboxQuestion[]);
      for (const q of inbox) {
        if (q.answered) continue;
        all.push({
          uid: `${projectIndex}:${q.id}`,
          projectIndex,
          projectName: p.name,
          projectPath: p.path,
          question: q,
        });
      }
    })
  );
  return NextResponse.json({ data: all });
}
