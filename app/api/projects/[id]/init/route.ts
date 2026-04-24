import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { spawn } from "child_process";
import path from "path";
import { REDEYE_PLUGIN_DIR } from "@/lib/claude-runner";

interface InitBody {
  vision?: string;
  firstTask?: string;
  deployCommand?: string;
  testCommand?: string;
  appUrl?: string;
}

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

    const body: InitBody = await req.json();

    const initScript = path.join(REDEYE_PLUGIN_DIR, "scripts", "init-project.sh");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PROJECT_NAME: project.name,
      VISION_TEXT: body.vision?.trim() || undefined,
      FIRST_BACKLOG_ITEM: body.firstTask?.trim() || undefined,
      DEPLOY_COMMAND: body.deployCommand?.trim() || undefined,
      TEST_COMMAND: body.testCommand?.trim() || undefined,
      APP_URL: body.appUrl?.trim() || undefined,
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
