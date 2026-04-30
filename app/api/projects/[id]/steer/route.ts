import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { readSteering, safeRedeyePath } from "@/lib/redeye-files";
import { applyDirectiveEdit, applyDirectiveDelete } from "@/lib/redeye-parsers";
import { sanitizeMarkdownInput } from "@/lib/markdown-sanitize";
import { readJsonBody } from "@/lib/json-body";
import { commitAndPush } from "@/lib/git-commit-push";
import { atomicWriteJson } from "@/lib/atomic-write";
import { withProjectLock } from "@/lib/state-mutex";
import fs from "fs/promises";

const MAX_BODY_BYTES = 64 * 1024;
// Edit/delete payloads are tiny ({index} or {index, text}); cap aggressively.
const MAX_MUTATE_BODY_BYTES = 4 * 1024;

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

    const directives = await readSteering(project.path);
    return NextResponse.json({ data: { directives } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read directives" },
      { status: 500 }
    );
  }
}

export async function POST(
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
  const project = await getProjectByIndex(index);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;
    const directiveRaw: unknown = body?.directive;
    if (typeof directiveRaw !== "string" || directiveRaw.length === 0) {
      return NextResponse.json({ error: "Missing required field: directive" }, { status: 400 });
    }
    const directive = sanitizeMarkdownInput(directiveRaw, { maxLen: 500 });
    if (directive.length === 0) {
      return NextResponse.json({ error: "Directive empty after sanitization" }, { status: 400 });
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");

    // Wrap the read-modify-write in withProjectLock so two concurrent POSTs
    // can't both read the same content, each compute an independent
    // insertion, and silently overwrite each other (TOCTOU lost update).
    await withProjectLock(project.path, async () => {
      let content: string;
      try {
        content = await fs.readFile(steeringPath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        content = "# Steering\n\n## Directives\n";
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const newDirective = `- ${directive} (${timestamp})\n`;

      const directivesHeader = "## Directives";
      const idx = content.indexOf(directivesHeader);
      if (idx !== -1) {
        const afterHeader = idx + directivesHeader.length;
        const nextLine = content.indexOf("\n", afterHeader);
        content = content.slice(0, nextLine + 1) + "\n" + newDirective + content.slice(nextLine + 1);
      } else {
        content += "\n## Directives\n\n" + newDirective;
      }

      await atomicWriteJson(steeringPath, content);
    });

    // Commit so TRIAGE's sync-from-main doesn't wipe this on the next
    // iteration. Best-effort — never fail the request just because git
    // is unhappy; the file is still on disk for now. Push is the user's
    // job; the local commit alone is the durability boundary.
    const { committed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: add steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add directive" },
      { status: 500 }
    );
  }
}

function parseIndex(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) return null;
  return raw;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectIndex = parseProjectIndex(id);
  if (projectIndex === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const project = await getProjectByIndex(projectIndex);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_MUTATE_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    const index = parseIndex(body?.index);
    if (index === null) {
      return NextResponse.json(
        { error: "Missing or invalid field: index (must be a non-negative integer)" },
        { status: 400 }
      );
    }
    const textRaw: unknown = body?.text;
    if (typeof textRaw !== "string" || textRaw.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 }
      );
    }
    const text = sanitizeMarkdownInput(textRaw, { maxLen: 500 });
    if (text.length === 0) {
      return NextResponse.json(
        { error: "Directive empty after sanitization" },
        { status: 400 }
      );
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");

    // Wrap read-modify-write in withProjectLock so concurrent PATCHes can't
    // race on the parsed indices (an edit by-index relies on the file state
    // observed during this call; without the lock, two writers would both
    // compute their target line from the same snapshot and the second
    // rename would silently overwrite the first edit).
    let result:
      | { kind: "ok" }
      | { kind: "missing" }
      | { kind: "range"; message: string };
    try {
      result = await withProjectLock(project.path, async () => {
        let content: string;
        try {
          content = await fs.readFile(steeringPath, "utf-8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { kind: "missing" } as const;
          }
          throw err;
        }

        let updated: string;
        try {
          updated = applyDirectiveEdit(content, index, text);
        } catch (err) {
          if (err instanceof RangeError) {
            return { kind: "range", message: err.message } as const;
          }
          throw err;
        }

        await atomicWriteJson(steeringPath, updated);
        return { kind: "ok" } as const;
      });
    } catch (lockErr) {
      throw lockErr;
    }

    if (result.kind === "missing") {
      return NextResponse.json(
        { error: "directive index out of range" },
        { status: 404 }
      );
    }
    if (result.kind === "range") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    const { committed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: edit steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to edit directive" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectIndex = parseProjectIndex(id);
  if (projectIndex === null) {
    return NextResponse.json(
      { error: "id must be a non-negative integer" },
      { status: 400 }
    );
  }
  const project = await getProjectByIndex(projectIndex);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const r = await readJsonBody<Record<string, unknown>>(req, MAX_MUTATE_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    const index = parseIndex(body?.index);
    if (index === null) {
      return NextResponse.json(
        { error: "Missing or invalid field: index (must be a non-negative integer)" },
        { status: 400 }
      );
    }

    const steeringPath = safeRedeyePath(project.path, "steering.md");

    // Wrap read-modify-write in withProjectLock so concurrent DELETEs can't
    // race — without it, two writers reading the same file state would each
    // compute a target index from the pre-mutation snapshot and the second
    // would either no-op (already gone) or worse, delete the wrong entry.
    let result:
      | { kind: "ok" }
      | { kind: "missing" }
      | { kind: "range"; message: string };
    try {
      result = await withProjectLock(project.path, async () => {
        let content: string;
        try {
          content = await fs.readFile(steeringPath, "utf-8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return { kind: "missing" } as const;
          }
          throw err;
        }

        let updated: string;
        try {
          updated = applyDirectiveDelete(content, index);
        } catch (err) {
          if (err instanceof RangeError) {
            return { kind: "range", message: err.message } as const;
          }
          throw err;
        }

        await atomicWriteJson(steeringPath, updated);
        return { kind: "ok" } as const;
      });
    } catch (lockErr) {
      throw lockErr;
    }

    if (result.kind === "missing") {
      return NextResponse.json(
        { error: "directive index out of range" },
        { status: 404 }
      );
    }
    if (result.kind === "range") {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }

    const { committed } = await commitAndPush(
      project.path,
      [".redeye/steering.md"],
      "ceo: delete steering directive (via dashboard)"
    );

    return NextResponse.json({ data: { success: true, committed } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete directive" },
      { status: 500 }
    );
  }
}
