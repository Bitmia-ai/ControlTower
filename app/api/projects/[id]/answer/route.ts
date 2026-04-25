import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionStatus, startSession } from "@/lib/session-manager";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { safeRedeyePath } from "@/lib/redeye-files";
import { readJsonBody } from "@/lib/json-body";
import fs from "fs/promises";

const QUESTION_ID_RE = /^Q-\d+$/;
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const index = parseInt(id, 10);
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Stream-read with a hard byte cap. A Content-Length-only check is
    // bypassable via Transfer-Encoding: chunked or a missing header.
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;
    const questionId: unknown = body?.questionId;
    const answerRaw: unknown = body?.answer;

    if (typeof questionId !== "string" || !QUESTION_ID_RE.test(questionId)) {
      return NextResponse.json(
        { error: "questionId must match Q-<number>" },
        { status: 400 }
      );
    }
    if (typeof answerRaw !== "string" || answerRaw.length === 0) {
      return NextResponse.json({ error: "Missing required field: answer" }, { status: 400 });
    }
    if (answerRaw.length > 4096) {
      return NextResponse.json({ error: "Answer too long (max 4096 chars)" }, { status: 400 });
    }
    // Strip newlines and markdown markers so a malicious answer can't forge
    // headers, bullet items, or backlog entries that RedEye would later read
    // as authoritative instructions (prompt-injection trust boundary).
    const answer = sanitizeMarkdownInput(answerRaw);

    const inboxPath = safeRedeyePath(project.path, "inbox.md");
    let content = await fs.readFile(inboxPath, "utf-8");

    // Build the question pattern from the validated questionId. Since
    // questionId is now guaranteed to match Q-<number>, no escape needed.
    const questionPattern = new RegExp(
      `(### ${questionId}[:\\s][^]*?)(?=\\n### |\\n## |$)`
    );
    const match = content.match(questionPattern);

    if (!match) {
      return NextResponse.json({ error: `Question ${questionId} not found` }, { status: 404 });
    }

    const questionBlock = match[1];

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

    if (content.includes("## Questions (Open)") && content.includes("## Answered / Provided")) {
      const openSection = content.match(/## Questions \(Open\)([\s\S]*?)(?=## Answered)/);
      if (openSection && openSection[1].includes(questionId)) {
        const updatedQuestion = content.match(questionPattern)?.[1] || "";
        content = content.replace(questionPattern, "");
        content = content.replace(
          "## Answered / Provided",
          `## Answered / Provided\n\n${updatedQuestion.trim()}\n`
        );
      }
    }

    await fs.writeFile(inboxPath, content, "utf-8");

    // Update state.json health counters atomically.
    const statePath = safeRedeyePath(project.path, "state.json");
    try {
      const stateRaw = await fs.readFile(statePath, "utf-8");
      const state = JSON.parse(stateRaw);
      if (state.health && state.health.questions_awaiting_ceo > 0) {
        state.health.questions_awaiting_ceo -= 1;
      }
      await atomicWriteJson(statePath, JSON.stringify(state, null, 2));
    } catch (stateErr) {
      console.error("[POST /answer] Failed to update state.json health counters:", stateErr);
    }

    // Auto-resume the CTO loop if it had stopped waiting on this answer.
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
