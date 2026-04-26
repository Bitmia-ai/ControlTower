// GET /api/projects/[id]/cost
// Returns { data: { session: number, total: number } }
// session = cost of current transcript file
// total = cost of all *.jsonl files in the Claude project dir

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import fs from "fs";
import { getProjectByIndex } from "@/lib/projects";
import { resolveTranscriptFile, encodeProjectPath } from "@/lib/transcript-file-resolver";
import { sumTranscriptFileCost } from "@/lib/cost-calculator";
import { mapWithConcurrency } from "@/lib/promise-pool";

/**
 * Limit how many transcript files are streamed in parallel. With cache
 * misses on cold start, an unbounded Promise.all over ~30 jsonl files
 * (each up to 60+ MB) opens that many concurrent readline pipelines
 * and stacks gigabytes of transient heap. With the mtime cache warm,
 * this limit is effectively a no-op.
 */
const COST_FANOUT_CONCURRENCY = 4;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Session cost: current transcript file
  const sessionFile = resolveTranscriptFile(project.path);
  const sessionCost = sessionFile ? await sumTranscriptFileCost(sessionFile) : 0;

  // Total cost: all *.jsonl files in the Claude project dir
  const encoded = encodeProjectPath(project.path);
  const cliDir = path.join(os.homedir(), ".claude", "projects", encoded);

  let totalCost = 0;
  try {
    const entries = fs.readdirSync(cliDir);
    const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl")).map((e) => path.join(cliDir, e));
    const costs = await mapWithConcurrency(
      jsonlFiles,
      COST_FANOUT_CONCURRENCY,
      sumTranscriptFileCost
    );
    totalCost = costs.reduce((sum, c) => sum + c, 0);
  } catch {
    // Directory doesn't exist or unreadable — total stays 0
  }

  // Also include the redeye session file in total if it's not already in cliDir
  // (the redeye session file lives in the project dir, not cliDir)
  if (sessionFile && !sessionFile.startsWith(cliDir)) {
    totalCost += sessionCost;
  }

  // Invariant: total must always >= session, even if cliDir scan failed
  totalCost = Math.max(totalCost, sessionCost);

  return NextResponse.json({ data: { session: sessionCost, total: totalCost } });
}
