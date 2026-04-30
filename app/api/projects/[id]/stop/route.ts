// POST /api/projects/[id]/stop — writes a STOP directive to .redeye/steering.md
// AND halts the running CTO session.
//
// Two-step semantics so Stop actually stops:
//   1. Append "STOP" to .redeye/steering.md (durable record of CEO intent that
//      survives a future Start; mirrors the `/redeye:stop` slash command).
//   2. Call stopSession() which sends SIGTERM with a 10 s grace, then SIGKILL.
//      Without (2), if the model is wedged (e.g. the slash-command → skill
//      bridge regression on 2026-04-29), the directive is never read and the
//      loop keeps burning tokens — which is the bug this route now fixes.
//
// `Pause` keeps its graceful-only behavior (writes PAUSE, doesn't kill).
// `Force Stop` keeps its no-directive immediate-kill behavior.

import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { safeRedeyePath } from "@/lib/redeye-files";
import { getStore, getSessionDriver } from "@/lib/app";
import { atomicWriteJson } from "@/lib/atomic-write";
import fs from "fs/promises";

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

    const steeringPath = safeRedeyePath(project.path, "steering.md");
    let content: string;
    try {
      content = await fs.readFile(steeringPath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        content = "";
      } else {
        throw err;
      }
    }

    const newDirective = `STOP — CEO directed stop at ${new Date().toISOString()}\n`;

    const directivesHeader = "## Directives";
    const idx = content.indexOf(directivesHeader);
    if (idx !== -1) {
      const afterHeader = idx + directivesHeader.length;
      const nextLine = content.indexOf("\n", afterHeader);
      content =
        content.slice(0, nextLine + 1) +
        "\n" +
        newDirective +
        content.slice(nextLine + 1);
    } else {
      const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n";
      content += `${prefix}\n## Directives\n\n${newDirective}`;
    }

    await atomicWriteJson(steeringPath, content);

    // Halt the loop. Best-effort — if the process is already gone or never
    // started, stopSession is a no-op. We don't surface the kill outcome
    // separately because (a) the steering write is the durable signal, and
    // (b) the dashboard polls the session status independently.
    await getSessionDriver().stop(project.path, "cto");

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
