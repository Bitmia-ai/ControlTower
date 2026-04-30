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

/**
 * Generic reader for `docs/<subdir>/*.md` archive files.
 *
 * RedEye's MERGE phase moves done items into per-month archive files under
 * docs/tasks-archive/, docs/inbox-archive/, and docs/changelog-archive/.
 * The active files (.redeye/tasks.md, .redeye/inbox.md, .redeye/changelog.md)
 * keep only un-archived entries. Done-item UIs need to surface BOTH active
 * and archived items, so each *Active* reader has an *Archived* counterpart.
 *
 * The three archive readers share a single shape: list directory, filter to
 * `.md`, optionally synthesize a section header (`parseTasks` and
 * `parseInbox` are section-aware; `parseChangelog` is not), parse each file,
 * optionally dedupe by id. This helper captures that shape.
 *
 * @param synthesizeHeader  prepended to each file's content before parsing,
 *                          or null to feed raw content through.
 * @param keyOf             extract a unique id for dedup, or null to skip dedup.
 */
async function readArchiveDir<T>(
  projectPath: string,
  subdir: string,
  synthesizeHeader: string | null,
  parser: (content: string) => T[],
  keyOf: ((item: T) => string) | null
): Promise<T[]> {
  const archiveDir = path.join(projectPath, "docs", subdir);
  let entries: string[];
  try {
    entries = await fs.readdir(archiveDir);
  } catch {
    return [];
  }
  const items: T[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const filePath = path.join(archiveDir, name);
    const content = await readFileOrNull(filePath);
    if (!content) continue;
    const source = synthesizeHeader ? `${synthesizeHeader}\n\n${content}` : content;
    items.push(...parser(source));
  }
  if (keyOf === null) return items;
  // Deduplicate by id — last occurrence wins (latest archive file).
  const seen = new Map<string, T>();
  for (const item of items) seen.set(keyOf(item), item);
  return Array.from(seen.values());
}

/**
 * Read all task entries from `docs/tasks-archive/*.md`.
 *
 * RedEye's MERGE phase runs `scripts/archive-task.sh` to remove a done task
 * from `.redeye/tasks.md` and append its full body to a dated archive file
 * (`docs/tasks-archive/YYYY-MM.md`). Done-task UIs (the Done section of the
 * Tasks tab, the Recently Shipped card on mission control, the per-task
 * detail page) need to surface those entries — `readTasks` alone returns
 * only the active items. Use this together with `readTasks` and merge.
 *
 * Archive files don't carry section headers (`## CEO Requests` etc.); their
 * task blocks live at the top level under a doc preamble. We feed them
 * through the same parser by prepending a synthetic section header.
 *
 * Items returned have `section: "ceo"` as a placeholder — callers shouldn't
 * rely on the section field for archived items; they're all done.
 */
export async function readArchivedTasks(
  projectPath: string
): Promise<TaskItem[]> {
  return readArchiveDir(
    projectPath,
    "tasks-archive",
    "## CEO Requests",
    parseTasks,
    (item) => item.id
  );
}

/**
 * Read active items from tasks.md plus all archived items, merged.
 * Active items take precedence on id collisions (a done task that's been
 * re-opened in tasks.md is the source of truth, not its archived snapshot).
 */
export async function readAllTasks(projectPath: string): Promise<TaskItem[]> {
  const [active, archived] = await Promise.all([
    readTasks(projectPath),
    readArchivedTasks(projectPath),
  ]);
  const byId = new Map<string, TaskItem>();
  for (const item of archived) byId.set(item.id, item);
  for (const item of active) byId.set(item.id, item); // active wins
  return Array.from(byId.values());
}

export async function readInbox(
  projectPath: string
): Promise<InboxQuestion[]> {
  const filePath = safeRedeyePath(projectPath, "inbox.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseInbox(content);
}

/**
 * Read every archived inbox entry from `docs/inbox-archive/*.md`.
 *
 * RedEye's MERGE phase calls `scripts/archive-inbox.sh` to pull every
 * Q-XXX block in `## Answered / Provided` that has an `**Incorporated:**`
 * line out of `.redeye/inbox.md` and into a dated archive file
 * (`docs/inbox-archive/YYYY-MM.md`). All archived entries are answered;
 * un-incorporated answers stay in the active inbox.
 *
 * Archive files have a doc preamble and Q blocks at the top level — we
 * prepend a synthetic `## Answered / Provided` header so `parseInbox`
 * (which is section-aware) finds them.
 */
export async function readArchivedInbox(
  projectPath: string
): Promise<InboxQuestion[]> {
  return readArchiveDir(
    projectPath,
    "inbox-archive",
    "## Answered / Provided",
    parseInbox,
    (item) => item.id
  );
}

export async function readChangelog(
  projectPath: string
): Promise<ChangelogEntry[]> {
  const filePath = safeRedeyePath(projectPath, "changelog.md");
  const content = await readFileOrNull(filePath);
  if (!content) return [];
  return parseChangelog(content);
}

/**
 * Read every archived changelog entry from `docs/changelog-archive/*.md`.
 *
 * RedEye's MERGE phase calls `scripts/archive-changelog.sh` to move any
 * `## Iteration N — TIMESTAMP` block dated in a previous month out of
 * `.redeye/changelog.md` and into `docs/changelog-archive/YYYY-MM.md`.
 *
 * `parseChangelog` matches `^## Iteration ...` headers globally, so no
 * section synthesis is needed for archive files.
 */
export async function readArchivedChangelog(
  projectPath: string
): Promise<ChangelogEntry[]> {
  return readArchiveDir(
    projectPath,
    "changelog-archive",
    null,
    parseChangelog,
    null
  );
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
  const [
    state,
    tasksRaw,
    archivedRaw,
    inbox,
    archivedInbox,
    changelog,
    archivedChangelog,
    steering,
  ] = await Promise.all([
    readState(projectPath),
    readTasks(projectPath),
    readArchivedTasks(projectPath),
    readInbox(projectPath),
    readArchivedInbox(projectPath),
    readChangelog(projectPath),
    readArchivedChangelog(projectPath),
    readSteering(projectPath),
  ]);

  // Merge active + archived for inbox / changelog views. Active wins on id
  // collision (an answered question that's been re-opened, etc.).
  const inboxById = new Map<string, InboxQuestion>();
  for (const q of archivedInbox) inboxById.set(q.id, q);
  for (const q of inbox) inboxById.set(q.id, q);
  const allInbox = Array.from(inboxById.values());

  // Active first (current-month entries are most recent and parseChangelog
  // preserves file order), archive after. The mission-control tile slices
  // the head, so existing behavior is preserved when the active file has
  // ≥ 5 entries; the archive only kicks in right after a month rollover.
  const allChangelog = [...changelog, ...archivedChangelog];

  // Enrich the tasks: if state.task_id matches an item, override its
  // status to "in-progress" ephemerally (not written back to disk).
  const activeId = state?.task_id ?? null;
  let activeItem: TaskItem | null = null;
  const tasks = tasksRaw.map((item) => {
    // Only promote to in-progress when the on-disk status is still pending
    // or planned. Never override a task that is already done, wontdo, parked,
    // blocked, etc. — see T109 for the bug report.
    if (
      activeId &&
      item.id === activeId &&
      (item.status === "pending" || item.status === "planned")
    ) {
      const enriched = { ...item, status: "in-progress" as const };
      activeItem = enriched;
      return enriched;
    }
    return item;
  });

  // Merge active + archived for done/wontdo views. Active wins on id collision
  // (a re-opened task overrides its archived snapshot).
  const byId = new Map<string, TaskItem>();
  for (const item of archivedRaw) byId.set(item.id, item);
  for (const item of tasks) byId.set(item.id, item);
  const allTasks = Array.from(byId.values());

  const currentTask = state?.task_title
    ? `${state.task_id ?? ""} ${state.task_title}`.trim()
    : null;
  // Open questions live only in the active inbox.md — archive only contains
  // incorporated (answered) entries. But source from `allInbox` so a
  // hypothetical id-collision (re-opened question) still surfaces correctly.
  const pendingQuestions = allInbox.filter((q) => !q.answered);
  const upNext = tasks.filter(
    (item) =>
      item.status === "planned" ||
      item.status === "pending" ||
      item.status === "in-progress"
  );
  const itemCosts = state?.item_costs ?? {};

  // All done items sorted newest-first with cost enrichment.
  // Used as the source for both recentlyShipped (sliced) and allDoneItems (full).
  // Sources from active + archived: most done tasks now live in
  // docs/tasks-archive/YYYY-MM.md after MERGE moves them out of tasks.md.
  const allDoneSorted = allTasks
    .filter((item) => item.status === "done")
    .sort((a, b) => {
      // Sort by mergedIteration descending — highest iteration number is most recent.
      // Items without an iteration number (older entries) fall to the bottom.
      const ai = a.mergedIteration ?? 0;
      const bi = b.mergedIteration ?? 0;
      return bi - ai;
    })
    .map((item) => {
      const cost = itemCosts[item.id];
      return cost !== undefined ? { ...item, cost_usd: cost } : item;
    });

  // Mission-control "Recently Shipped" card — limited to 10 most recent.
  const recentlyShipped = allDoneSorted.slice(0, 10);

  // Full list for the Tasks page Done section — all done items, no slice.
  const allDoneItems = allDoneSorted;

  // parseTasks normalizes both "wont-do" and "won't do" raw values to the
  // single canonical status "wontdo"; section is also "wontdo". Source on
  // status so a section-misplaced item still surfaces.
  const wontDoItems = allTasks.filter((item) => item.status === "wontdo");
  const recentChangelog = allChangelog.slice(0, 5);

  return {
    project,
    state,
    currentTask,
    activeItem,
    pendingQuestions,
    upNext,
    recentlyShipped,
    allDoneItems,
    wontDoItems,
    recentChangelog,
    steeringDirectives: steering,
  };
}
