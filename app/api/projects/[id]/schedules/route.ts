// GET /api/projects/[id]/schedules
// Returns { data: { schedules: ScheduleEntry[] } }
// Reads .redeye/schedules.md and parses all SCHED-{id} blocks.
//
// POST /api/projects/[id]/schedules
// Creates a new SCHED-{id} entry in .redeye/schedules.md.
// Body: { name: string, frequency: string, description?: string, steps: string[] }
// Returns { data: { success: true, schedule: ScheduleEntry, committed } }

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { parseProjectIndex } from "@/lib/projects";
import { getStore } from "@/lib/app";
import { parseSchedules } from "@/lib/redeye-parsers";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import { safeRedeyePath } from "@/lib/redeye-files";
import { commitAndPush } from "@/lib/git-commit-push";
import { atomicWriteJson } from "@/lib/atomic-write";
import { withProjectLock } from "@/lib/state-mutex";
import type { ScheduleEntry } from "@/lib/redeye-types";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STEPS = 50;

async function readSchedulesMd(projectPath: string): Promise<string | null> {
  try {
    return await fs.readFile(safeRedeyePath(projectPath, "schedules.md"), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ data: { schedules: ScheduleEntry[] } } | { error: string }>> {
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

    const content = await readSchedulesMd(project.path);
    const schedules = content ? parseSchedules(content) : [];

    return NextResponse.json({ data: { schedules } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Scan the existing schedules.md content and return the next SCHED id.
 * Falls back to 1 when no SCHED-N entries exist.
 */
export function nextSchedIdFromContent(content: string): number {
  const matches = content.matchAll(/SCHED-(\d+)/gi);
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Build the markdown block for a new schedule entry.  Format matches
 * the pattern parsed by `parseSchedules` exactly so a fresh write
 * round-trips cleanly through the GET handler.
 */
export function buildScheduleBlock(opts: {
  id: string;
  name: string;
  frequency: string;
  steps: string[];
  assignedTo?: string;
}): string {
  const stepLines = opts.steps
    .map((s, i) => `  ${i + 1}. ${s}`)
    .join("\n");
  const assigned = opts.assignedTo && opts.assignedTo.length > 0
    ? opts.assignedTo
    : "CTO";

  return [
    `### ${opts.id}: ${opts.name}`,
    `- **Frequency:** ${opts.frequency}`,
    // Use "—" so the parser treats this as never-run (lastRunIso = null).
    // A real ISO timestamp like "1970-01-01T00:00:00Z" would be parsed as
    // valid and make the schedule appear overdue with "Next: 56 years ago".
    `- **Last run:** —`,
    `- **Task:**`,
    stepLines,
    `- **Assigned to:** ${assigned}`,
    ``,
  ].join("\n");
}

export async function POST(
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

    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    // name
    const nameRaw: unknown = body?.name;
    if (typeof nameRaw !== "string" || nameRaw.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }
    const name = sanitizeMarkdownInput(nameRaw, { maxLen: 200 });
    if (name.length === 0) {
      return NextResponse.json(
        { error: "name empty after sanitization" },
        { status: 400 }
      );
    }

    // frequency
    const freqRaw: unknown = body?.frequency;
    if (typeof freqRaw !== "string" || freqRaw.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: frequency" },
        { status: 400 }
      );
    }
    const frequency = sanitizeMarkdownInput(freqRaw, { maxLen: 100 });
    if (frequency.length === 0) {
      return NextResponse.json(
        { error: "frequency empty after sanitization" },
        { status: 400 }
      );
    }

    // steps
    const stepsRaw: unknown = body?.steps;
    if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: steps (must be a non-empty array)" },
        { status: 400 }
      );
    }
    const steps: string[] = [];
    for (const s of stepsRaw) {
      if (typeof s !== "string") continue;
      const cleaned = sanitizeMarkdownInput(s, { maxLen: 500 });
      if (cleaned.length > 0) steps.push(cleaned);
      if (steps.length >= MAX_STEPS) break;
    }
    if (steps.length === 0) {
      return NextResponse.json(
        { error: "steps must contain at least one non-empty entry" },
        { status: 400 }
      );
    }

    // Wrap nextSchedIdFromContent + read + write in withProjectLock so two
    // concurrent POSTs can't both observe the same max SCHED-N from a stale
    // file snapshot, allocate the same id, and have one writer's append
    // silently overwrite the other's.
    const { schedId, updated } = await withProjectLock(project.path, async () => {
      let content: string;
      try {
        content = await fs.readFile(safeRedeyePath(project.path, "schedules.md"), "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        content = "# Scheduled Tasks\n\n_(Define recurring tasks here.)_\n";
      }

      const nextN = nextSchedIdFromContent(content);
      const allocatedId = `SCHED-${nextN}`;

      const block = buildScheduleBlock({
        id: allocatedId,
        name,
        frequency,
        steps,
      });

      // Ensure a blank line separates the new block from the prior content.
      const sep = content.endsWith("\n\n")
        ? ""
        : content.endsWith("\n")
          ? "\n"
          : "\n\n";
      const newContent = content + sep + block;

      await atomicWriteJson(safeRedeyePath(project.path, "schedules.md"), newContent);
      return { schedId: allocatedId, updated: newContent };
    });

    // Best-effort commit so TRIAGE's sync-from-main on the next iteration
    // doesn't drop the new schedule. Push is the user's job; the local
    // commit alone is the durability boundary.
    const { committed } = await commitAndPush(
      project.path,
      [".redeye/schedules.md"],
      `ceo: add schedule ${schedId} (via dashboard)`
    );

    // Re-parse the file so the response carries a fully-resolved
    // ScheduleEntry (matches the shape returned by GET).
    const parsed = parseSchedules(updated);
    const schedule = parsed.find((s) => s.id === schedId) ?? null;

    return NextResponse.json({
      data: { success: true, schedule, committed },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
