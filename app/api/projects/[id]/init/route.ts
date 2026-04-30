import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
import { spawn } from "child_process";
import path from "path";
import { REDEYE_PLUGIN_DIR } from "@/lib/claude-runner";
import { readJsonBody } from "@/lib/json-body";

interface InitBody {
  vision?: string;
  firstTask?: string;
  deployCommand?: string;
  testCommand?: string;
  appUrl?: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_FIELD_LEN = 4096;

/** Refuse strings containing shell metachars or newlines that would break
 *  the bash subprocess when interpolated by init-project.sh. */
function safeFieldOrThrow(name: string, v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") {
    throw new Error(`${name} must be a string`);
  }
  if (v.length > MAX_FIELD_LEN) {
    throw new Error(`${name} too long (max ${MAX_FIELD_LEN} chars)`);
  }
  // Strip control chars (incl. CR/LF) and reject backticks/$ which would be
  // interpreted by bash if init-project.sh ever quotes incorrectly.
  if (/[\x00-\x08\x0B-\x1F\x7F\r\n\t]/.test(v) || /[`$\\]/.test(v)) {
    throw new Error(`${name} contains forbidden characters`);
  }
  return v.trim() || undefined;
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
    const project = await getProjectByIndex(index);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const r = await readJsonBody<InitBody>(req, MAX_BODY_BYTES);
    if (!r.ok) return r.response;
    const body = r.data;

    // Validate and bound every field that flows into the bash environment.
    const fields: Record<string, string | undefined> = {};
    try {
      fields.VISION_TEXT = safeFieldOrThrow("vision", body.vision);
      fields.FIRST_TASK = safeFieldOrThrow("firstTask", body.firstTask);
      fields.DEPLOY_COMMAND = safeFieldOrThrow("deployCommand", body.deployCommand);
      fields.TEST_COMMAND = safeFieldOrThrow("testCommand", body.testCommand);
      fields.APP_URL = safeFieldOrThrow("appUrl", body.appUrl);
    } catch (validationErr) {
      return NextResponse.json(
        { error: validationErr instanceof Error ? validationErr.message : "Invalid field" },
        { status: 400 }
      );
    }

    const initScript = path.join(REDEYE_PLUGIN_DIR, "scripts", "init-project.sh");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PROJECT_NAME: project.name,
      ...fields,
    };

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn("bash", [initScript, project.path], {
        cwd: project.path,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

      proc.on("close", (code) => {
        // The script may exit non-zero if git commit fails (pre-commit hooks),
        // but the .redeye/ files are still created successfully. Treat as success
        // if stdout contains "Created:" or "Done!" indicators.
        if (code !== 0 && !stdout.includes("Created:") && !stdout.includes("Done!")) {
          reject(new Error(`init-project.sh failed: ${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", reject);
    });

    return NextResponse.json({ data: { success: true, output: result } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
