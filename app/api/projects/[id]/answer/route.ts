import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import fs from "fs/promises";
import path from "path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const questionId: string = body?.questionId;
  const answer: string = body?.answer;

  if (!questionId || typeof questionId !== "string") {
    return NextResponse.json({ error: "Missing required field: questionId" }, { status: 400 });
  }
  if (!answer || typeof answer !== "string") {
    return NextResponse.json({ error: "Missing required field: answer" }, { status: 400 });
  }

  try {
    const inboxPath = path.join(project.path, ".redeye", "inbox.md");
    let content = await fs.readFile(inboxPath, "utf-8");

    // Find the question block and add the answer
    const questionPattern = new RegExp(
      `(### ${questionId}[:\\s][^]*?)(?=\\n### |\\n## |$)`
    );
    const match = content.match(questionPattern);

    if (!match) {
      return NextResponse.json({ error: `Question ${questionId} not found` }, { status: 404 });
    }

    const questionBlock = match[1];

    // If already has an Answer field, update it; otherwise append
    if (questionBlock.includes("**Answer:**")) {
      content = content.replace(
        questionPattern,
        questionBlock.replace(/- \*\*Answer:\*\* .+/, `- **Answer:** ${answer}`)
      );
    } else {
      content = content.replace(
        questionPattern,
        questionBlock.trimEnd() + `\n- **Answer:** ${answer}\n`
      );
    }

    // Move from Open to Answered section if it's in Open
    if (content.includes("## Questions (Open)") && content.includes("## Answered / Provided")) {
      const openSection = content.match(/## Questions \(Open\)([\s\S]*?)(?=## Answered)/);
      if (openSection && openSection[1].includes(questionId)) {
        // Remove from Open
        const updatedQuestion = content.match(questionPattern)?.[1] || "";
        content = content.replace(questionPattern, "");
        // Add to Answered
        content = content.replace(
          "## Answered / Provided",
          `## Answered / Provided\n\n${updatedQuestion.trim()}\n`
        );
      }
    }

    await fs.writeFile(inboxPath, content, "utf-8");

    // Update state.json health counters immediately
    const statePath = path.join(project.path, ".redeye", "state.json");
    try {
      const stateRaw = await fs.readFile(statePath, "utf-8");
      const state = JSON.parse(stateRaw);
      if (state.health && state.health.questions_awaiting_ceo > 0) {
        state.health.questions_awaiting_ceo -= 1;
      }
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    } catch (stateErr) {
      console.error("[POST /answer] Failed to update state.json health counters:", stateErr);
    }

    // Auto-resume the CTO loop if it had stopped waiting for this answer.
    // Without this, the user replies but nothing happens until they manually
    // hit Start — confusing UX (see BL-060).
    let resumed = false;
    try {
      const session = getSessionStatus(project.path);
      if (session.cto.status === "stopped") {
        await startSession(project.path, "cto");
        resumed = true;
      }
    } catch (sessionErr) {
      console.error("[POST /answer] Failed to auto-resume CTO:", sessionErr);
    }

    return NextResponse.json({ data: { success: true, resumed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to write answer" },
      { status: 500 }
    );
  }
}
