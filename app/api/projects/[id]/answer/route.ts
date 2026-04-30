import { NextRequest, NextResponse } from "next/server";
import { parseProjectIndex } from "@/lib/projects";
import { getStore, getSessionDriver } from "@/lib/app";
import { atomicWriteJson } from "@/lib/atomic-write";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { safeRedeyePath } from "@/lib/redeye-files";
import { readJsonBody } from "@/lib/json-body";
import { commitAndPush } from "@/lib/git-commit-push";
import { withProjectLock } from "@/lib/state-mutex";
import * as logger from "@/lib/logger";
import fs from "fs/promises";

const QUESTION_ID_RE = /^Q-\d+$/;
const MAX_BODY_BYTES = 64 * 1024;

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
    // headers, bullet items, or tasks that RedEye would later read
    // as authoritative instructions (prompt-injection trust boundary).
    const answer = sanitizeMarkdownInput(answerRaw);

    const inboxPath = safeRedeyePath(project.path, "inbox.md");
    const statePath = safeRedeyePath(project.path, "state.json");

    // Inbox read-modify-write and state.json read-modify-write both happen
    // inside the same project lock so two concurrent /answer requests can't
    // race — without this, the second writer would observe stale inbox
    // content (its match would still hit the "Open" section) and silently
    // overwrite the first writer's edit. Same lost-update concern applies
    // to state.json's questions_awaiting_ceo counter.
    let notFound = false;
    try {
      await withProjectLock(project.path, async () => {
        let content = await fs.readFile(inboxPath, "utf-8");

        // Build the question pattern from the validated questionId. Since
        // questionId is now guaranteed to match Q-<number>, no escape needed.
        const questionPattern = new RegExp(
          `(### ${questionId}[:\\s][^]*?)(?=\\n### |\\n## |$)`
        );
        const match = content.match(questionPattern);

        if (!match) {
          notFound = true;
          return;
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

        await atomicWriteJson(inboxPath, content);

        // Update state.json health counters atomically. The whole
        // read-modify-write must be inside withProjectLock so two concurrent
        // /answer requests can't both read the same counter and each
        // decrement-then-write — the second write would otherwise silently
        // discard the first decrement (TOCTOU lost update).
        try {
          const stateRaw = await fs.readFile(statePath, "utf-8");
          const state = JSON.parse(stateRaw);
          if (state.health && state.health.questions_awaiting_ceo > 0) {
            state.health.questions_awaiting_ceo -= 1;
          }
          await atomicWriteJson(statePath, JSON.stringify(state, null, 2));
        } catch (stateErr) {
          logger.error("POST /answer", "Failed to update state.json health counters:", stateErr);
        }
      });
    } catch (lockErr) {
      // Re-throw the inbox read failure (or any other inbox r/m/w error) so
      // the outer catch turns it into a 500. The state.json failure is
      // swallowed inside the lock above to keep its best-effort semantics.
      throw lockErr;
    }

    if (notFound) {
      return NextResponse.json({ error: `Question ${questionId} not found` }, { status: 404 });
    }

    // Commit so TRIAGE's inbox sync-from-main re-reads the same
    // answer instead of overwriting our local edit. Best-effort — push
    // is the user's job; the local commit alone is the durability
    // boundary. Includes both inbox.md (the answer) and state.json (the
    // decremented health counter) so they land atomically as one commit.
    const { committed } = await commitAndPush(
      project.path,
      [".redeye/inbox.md", ".redeye/state.json"],
      `ceo: answer ${questionId} (via dashboard)`
    );

    // Auto-resume the CTO loop if it had stopped waiting on this answer.
    let resumed = false;
    try {
      const session = getSessionDriver().status(project.path);
      if (session.cto.status === "stopped") {
        await getSessionDriver().start(project.path, "cto");
        resumed = true;
      }
    } catch (sessionErr) {
      logger.error("POST /answer", "Failed to auto-resume CTO:", sessionErr);
    }

    return NextResponse.json({ data: { success: true, resumed, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to write answer" },
      { status: 500 }
    );
  }
}
