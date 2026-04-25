import fs from "fs/promises";
import path from "path";
import type {
  RedEyeState,
  BacklogItem,
  InboxQuestion,
  ChangelogEntry,
  SteeringDirective,
  ProjectDetail,
  ProjectWithStatus,
} from "./redeye-types";
import {
  parseBacklog,
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

export async function readBacklog(projectPath: string): Promise<BacklogItem[]> {
  const filePath = safeRedeyePath(projectPath, "backlog.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseBacklog(content);
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
 * Scan `.redeye/backlog.md` and return the highest numeric suffix found in any
 * `BL-\d+` pattern.  Returns 0 if the file is missing or contains no matches.
 *
 * NOTE: This reads the raw text, so it will match BL-xxx wherever it appears
 * (headers, inline references, etc.).  That is intentional — we want the true
 * maximum ID present in the file regardless of formatting.
 */
export async function scanMaxBacklogId(projectPath: string): Promise<number> {
  const filePath = safeRedeyePath(projectPath, "backlog.md");
  const content = await readFileOrNull(filePath);
  if (!content) return 0;

  const regex = /BL-(\d+)/g;
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
  const [state, backlogRaw, inbox, changelog, steering] = await Promise.all([
    readState(projectPath),
    readBacklog(projectPath),
    readInbox(projectPath),
    readChangelog(projectPath),
    readSteering(projectPath),
  ]);

  // Enrich the backlog: if state.backlog_item matches an item, override its
  // status to "in-progress" ephemerally (not written back to disk).
  const activeId = state?.backlog_item ?? null;
  let activeItem: BacklogItem | null = null;
  const backlog = backlogRaw.map((item) => {
    if (activeId && item.id === activeId) {
      const enriched = { ...item, status: "in-progress" as const };
      activeItem = enriched;
      return enriched;
    }
    return item;
  });

  const currentTask = state?.backlog_title
    ? `${state.backlog_item ?? ""} ${state.backlog_title}`.trim()
    : null;
  const pendingQuestions = inbox.filter((q) => !q.answered);
  const upNext = backlog.filter(
    (item) =>
      item.status === "planned" ||
      item.status === "pending" ||
      item.status === "in-progress"
  );
  const itemCosts = state?.item_costs ?? {};
  const recentlyShipped = backlog
    .filter((item) => item.status === "done")
    .map((item) => {
      const cost = itemCosts[item.id];
      return cost !== undefined ? { ...item, cost_usd: cost } : item;
    });
  const recentChangelog = changelog.slice(0, 5);

  return {
    project,
    state,
    currentTask,
    activeItem,
    pendingQuestions,
    upNext,
    recentlyShipped,
    recentChangelog,
    steeringDirectives: steering,
  };
}
