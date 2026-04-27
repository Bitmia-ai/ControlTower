import fs from "fs/promises";
import path from "path";
import type {
  RedEyeState,
  TaskItem,
  InboxQuestion,
  ChangelogEntry,
  SteeringDirective,
  ProjectDetail,
  ProjectWithStatus,
} from "./redeye-types";
import {
  parseTasks,
  parseInbox,
  parseChangelog,
  parseSteering,
} from "./redeye-parsers";

/**
 * Resolve a path inside projectPath/.redeye/ and reject path traversal.
 * Exported so other route handlers can use the same guard instead of
 * reinventing path.join() and risking a future traversal vector.
 *
 * Note: this guards against `..` in the constructed path. It does NOT
 * `realpath` the result — symlinks inside .redeye/ are not followed and
 * not validated. Add a separate `realpath` step on read paths if you
 * want to defend against symlink-based exfiltration; current trust model
 * assumes the project's `.redeye/` is owned by the user.
 */
export function safeRedeyePath(projectPath: string, filename: string): string {
  // Disallow traversal characters in the filename itself
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  const projectResolved = path.resolve(projectPath);
  const filePath = path.resolve(projectResolved, ".redeye", filename);

  if (!filePath.startsWith(projectResolved + path.sep)) {
    throw new Error(
      `Path traversal detected: ${filename} escapes project directory`
    );
  }

  return filePath;
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function readState(
  projectPath: string
): Promise<RedEyeState | null> {
  const filePath = safeRedeyePath(projectPath, "state.json");
  const content = await readFileOrNull(filePath);
  if (!content) return null;

  try {
    return JSON.parse(content) as RedEyeState;
  } catch {
    return null;
  }
}

export async function readTasks(projectPath: string): Promise<TaskItem[]> {
  const filePath = safeRedeyePath(projectPath, "tasks.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseTasks(content);
}

export async function readInbox(
  projectPath: string
): Promise<InboxQuestion[]> {
  const filePath = safeRedeyePath(projectPath, "inbox.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseInbox(content);
}

export async function readChangelog(
  projectPath: string
): Promise<ChangelogEntry[]> {
  const filePath = safeRedeyePath(projectPath, "changelog.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseChangelog(content);
}

export async function readSteering(
  projectPath: string
): Promise<SteeringDirective[]> {
  const filePath = safeRedeyePath(projectPath, "steering.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseSteering(content);
}

export async function readStatus(projectPath: string): Promise<string> {
  const filePath = safeRedeyePath(projectPath, "status.md");
  const content = await readFileOrNull(filePath);
  return content ?? "";
}

export async function isInitialized(projectPath: string): Promise<boolean> {
  try {
    const filePath = safeRedeyePath(projectPath, "state.json");
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan `.redeye/tasks.md` and return the highest numeric suffix found in any
 * `T\d+` pattern.  Returns 0 if the file is missing or contains no matches.
 *
 * NOTE: This reads the raw text, so it will match T<N> wherever it appears
 * (headers, inline references, etc.).  That is intentional — we want the true
 * maximum ID present in the file regardless of formatting.
 */
export async function scanMaxTaskId(projectPath: string): Promise<number> {
  const filePath = safeRedeyePath(projectPath, "tasks.md");
  const content = await readFileOrNull(filePath);
  if (!content) return 0;

  const regex = /T(\d+)/g;
  let max = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(content)) !== null) {
    const n = parseInt(match[1], 10);
    if (n > max) max = n;
  }
  return max;
}

export async function readProjectDetail(
  projectPath: string,
  project: ProjectWithStatus
): Promise<ProjectDetail> {
  const [state, tasksRaw, inbox, changelog, steering] = await Promise.all([
    readState(projectPath),
    readTasks(projectPath),
    readInbox(projectPath),
    readChangelog(projectPath),
    readSteering(projectPath),
  ]);

  // Enrich the tasks: if state.task_id matches an item, override its
  // status to "in-progress" ephemerally (not written back to disk).
  const activeId = state?.task_id ?? null;
  let activeItem: TaskItem | null = null;
  const tasks = tasksRaw.map((item) => {
    if (activeId && item.id === activeId) {
      const enriched = { ...item, status: "in-progress" as const };
      activeItem = enriched;
      return enriched;
    }
    return item;
  });

  const currentTask = state?.task_title
    ? `${state.task_id ?? ""} ${state.task_title}`.trim()
    : null;
  const pendingQuestions = inbox.filter((q) => !q.answered);
  const upNext = tasks.filter(
    (item) =>
      item.status === "planned" ||
      item.status === "pending" ||
      item.status === "in-progress"
  );
  const itemCosts = state?.item_costs ?? {};
  const recentlyShipped = tasks
    .filter((item) => item.status === "done")
    .sort((a, b) => {
      // Sort by mergedIteration descending — highest iteration number is most recent.
      // Items without an iteration number (older entries) fall to the bottom.
      const ai = a.mergedIteration ?? 0;
      const bi = b.mergedIteration ?? 0;
      return bi - ai;
    })
    .slice(0, 8)
    .map((item) => {
      const cost = itemCosts[item.id];
      return cost !== undefined ? { ...item, cost_usd: cost } : item;
    });
  // parseTasks normalizes both "wont-do" and "won't do" raw values to the
  // single canonical status "wontdo"; section is also "wontdo". Source on
  // status so a section-misplaced item still surfaces.
  const wontDoItems = tasks.filter((item) => item.status === "wontdo");
  const recentChangelog = changelog.slice(0, 5);

  return {
    project,
    state,
    currentTask,
    activeItem,
    pendingQuestions,
    upNext,
    recentlyShipped,
    wontDoItems,
    recentChangelog,
    steeringDirectives: steering,
  };
}
