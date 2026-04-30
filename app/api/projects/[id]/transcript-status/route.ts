// GET /api/projects/[id]/transcript-status
//
// Returns { available, source, mtime, ageSeconds } to let the Live tab decide
// whether to open an EventSource and what banner to display.
//
// source is "redeye" for .redeye/session-cto.jsonl, "cli" for Claude CLI transcripts,
// or null when no transcript file is available.

import { NextRequest, NextResponse } from "next/server";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getTranscriptSource } from "@/lib/app";

const REDEYE_SESSION_FILE = ".redeye/session-cto.jsonl";

export interface TranscriptStatus {
  available: boolean;
  source: "redeye" | "cli" | null;
  mtime: string | null;
  ageSeconds: number | null;
}

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
  const project = await getStore().byIndex(index);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const resolvedFile = getTranscriptSource().resolve(project.path);

    if (!resolvedFile) {
      const result: TranscriptStatus = {
        available: false,
        source: null,
        mtime: null,
        ageSeconds: null,
      };
      return NextResponse.json({ data: result });
    }

    // Try to stat the file to get mtime
    let stats: Stats;
    try {
      stats = await fs.stat(resolvedFile);
    } catch {
      // File was resolved but is now gone or unreadable
      const result: TranscriptStatus = {
        available: false,
        source: null,
        mtime: null,
        ageSeconds: null,
      };
      return NextResponse.json({ data: result });
    }

    const redeyeFile = path.join(project.path, REDEYE_SESSION_FILE);
    const source: "redeye" | "cli" = resolvedFile === redeyeFile ? "redeye" : "cli";
    const mtimeDate = new Date(stats.mtimeMs);
    const ageSeconds = Math.round((Date.now() - stats.mtimeMs) / 1000);

    const result: TranscriptStatus = {
      available: true,
      source,
      mtime: mtimeDate.toISOString(),
      ageSeconds,
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
