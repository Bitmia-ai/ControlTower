export interface Project {
  name: string;
  path: string;
}

export interface ProjectWithStatus extends Project {
  initialized: boolean;
  running: boolean;
  sessionStatus?: SessionStatus;
  phase?: string;
  /** Concatenated "T149 Bug: TOCTOU race…" — used by the legacy home card. */
  currentTask?: string | null;
  /** Active task id (e.g. "T149") — set when state.task_id is non-null. */
  taskId?: string | null;
  /** Active task title (no id prefix) — set when state.task_title is non-null. */
  taskTitle?: string | null;
  questionCount?: number;
  /** Number of pending/planned/in-progress items in tasks.md (excludes done/wontdo). */
  backlogCount?: number;
  /** Number of `done` items in tasks.md (live, not archived). */
  doneCount?: number;
  /** True when at least one SCHED-N entry exists in schedules.md. */
  scheduleEnabled?: boolean;
  /** Human one-liner like "Weekdays · 9pm" derived from the most-recent schedule. */
  scheduleSummary?: string | null;
}

export interface RedEyeState {
  iteration: number;
  phase: Phase;
  phase_status: PhaseStatus;
  task_id: string | null;
  task_title: string | null;
  spec_file: string | null;
  review_cycles: number;
  health: {
    confidence: "HIGH" | "MEDIUM" | "LOW";
    env_status: "healthy" | "unhealthy" | "unknown";
    iterations_since_last_deploy: number;
    questions_awaiting_ceo: number;
    blocked_items_count: number;
  };
  counters: {
    next_task_id: number;
    next_q_id: number;
  };
  /** Cost in USD per completed task, keyed by T<N>. Append-only. */
  item_costs?: Record<string, number>;
  /** Session cost at task start, keyed by T<N>. Used for delta calculation. */
  item_cost_starts?: Record<string, number>;
  /** Absolute path to the worktree where the active task is being built. Null when no worktree. */
  worktree_path?: string | null;
  /** Branch name of the active worktree (e.g. "redeye/T013"). Null when no worktree. */
  worktree_branch?: string | null;
  /**
   * Append-only history of iterations the CTO ran. Each entry summarizes
   * what the team did in one iteration and is the source of truth for the
   * History page's per-session "Activity" panel.
   */
  iteration_log?: IterationLogEntry[];
}

export interface IterationLogEntry {
  iteration: number;
  phases: string[];
  outcome: string;
  next?: string;
  /** ISO 8601 timestamp written when the entry was appended. */
  timestamp: string;
}

export type Phase =
  | "TRIAGE"
  | "PLAN"
  | "BUILD"
  | "REVIEW"
  | "DEPLOY"
  | "VERIFY"
  | "MERGE"
  | "HARDEN"
  | "STABILIZE"
  | "INCORPORATE"
  | "SCHEDULES"
  | (string & {});

export type PhaseStatus =
  | "pending"
  | "in-progress"
  | "complete"
  | (string & {});

export const PHASE_LABELS: Record<string, string> = {
  TRIAGE: "Triaging",
  PLAN: "Planning",
  BUILD: "Building",
  REVIEW: "Reviewing",
  DEPLOY: "Deploying",
  VERIFY: "Verifying",
  MERGE: "Merging",
  HARDEN: "Improving",
  STABILIZE: "Stabilizing",
  INCORPORATE: "Incorporating feedback",
  SCHEDULES: "Running scheduled tasks",
};

/**
 * Normalize a phase string (case-insensitive, trims whitespace) to its
 * canonical UPPER-CASE key.  The phase field in `state.json` is sometimes
 * persisted as lower-case (e.g. "build") and sometimes upper-case
 * (e.g. "BUILD") depending on which writer was last to touch it; UI lookups
 * against PHASE_LABELS / PHASE_COLORS expect UPPER-CASE.  Use this helper at
 * any UI boundary that reads `state.phase`.
 *
 * Returns "" if input is null/undefined/empty so callers can fall back to
 * a default label such as "Idle".
 */
export function normalizePhase(phase: string | null | undefined): string {
  if (!phase) return "";
  return String(phase).trim().toUpperCase();
}

/**
 * Returns the human-friendly label for a phase, accepting any case.  Falls
 * back to the (normalized) phase string itself if no label is defined.
 */
export function getPhaseLabel(phase: string | null | undefined): string {
  const key = normalizePhase(phase);
  if (!key) return "";
  return PHASE_LABELS[key] ?? key;
}

/**
 * Returns the colour palette for a phase, accepting any case.  Returns
 * `undefined` when no entry exists so the caller can apply a neutral fallback.
 */
export function getPhaseColors(
  phase: string | null | undefined
): { bg: string; text: string; shimmer: string } | undefined {
  const key = normalizePhase(phase);
  if (!key) return undefined;
  return PHASE_COLORS[key];
}

export const PHASE_COLORS: Record<string, { bg: string; text: string; shimmer: string }> = {
  TRIAGE: { bg: "bg-gray-100 dark:bg-zinc-700", text: "text-gray-700 dark:text-zinc-200", shimmer: "from-gray-100 via-gray-200 to-gray-100 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" },
  PLAN: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", shimmer: "from-blue-100 via-blue-200 to-blue-100 dark:from-blue-900/40 dark:via-blue-800/50 dark:to-blue-900/40" },
  BUILD: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", shimmer: "from-blue-100 via-blue-200 to-blue-100 dark:from-blue-900/40 dark:via-blue-800/50 dark:to-blue-900/40" },
  REVIEW: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", shimmer: "from-amber-100 via-amber-200 to-amber-100 dark:from-amber-900/40 dark:via-amber-800/50 dark:to-amber-900/40" },
  DEPLOY: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", shimmer: "from-green-100 via-green-200 to-green-100 dark:from-green-900/40 dark:via-green-800/50 dark:to-green-900/40" },
  VERIFY: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", shimmer: "from-green-100 via-green-200 to-green-100 dark:from-green-900/40 dark:via-green-800/50 dark:to-green-900/40" },
  MERGE: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", shimmer: "from-green-100 via-green-200 to-green-100 dark:from-green-900/40 dark:via-green-800/50 dark:to-green-900/40" },
  HARDEN: { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300", shimmer: "from-violet-100 via-violet-200 to-violet-100 dark:from-violet-900/40 dark:via-violet-800/50 dark:to-violet-900/40" },
  STABILIZE: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", shimmer: "from-red-100 via-red-200 to-red-100 dark:from-red-900/40 dark:via-red-800/50 dark:to-red-900/40" },
  INCORPORATE: { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300", shimmer: "from-cyan-100 via-cyan-200 to-cyan-100 dark:from-cyan-900/40 dark:via-cyan-800/50 dark:to-cyan-900/40" },
  SCHEDULES: { bg: "bg-gray-100 dark:bg-zinc-700", text: "text-gray-700 dark:text-zinc-200", shimmer: "from-gray-100 via-gray-200 to-gray-100 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700" },
};

export interface TaskItem {
  id: string;
  title: string;
  type?: string;
  priority?: string;
  status: "pending" | "planned" | "in-progress" | "done" | "blocked" | "pending-triage" | "wontdo";
  section: "ceo" | "discovered" | "triaged" | "wontdo";
  details?: string;
  spec?: string;
  /** Estimated cost in USD for this item. Set at completion time via cost-snapshot API. */
  cost_usd?: number;
  /** Single-line LLM-authored summary of what shipped. Written by CTO at VERIFY time. */
  summary?: string;
  /**
   * Full description text from the `**Description:**` field in tasks.md.
   * May be multi-paragraph markdown (lists, code blocks, links).
   * Present on tasks where the CEO included detailed acceptance criteria.
   */
  description?: string;
  /** Rationale text from `**Reason:**` field — typically present on wont-do items. */
  reason?: string;
  /**
   * ISO date string (YYYY-MM-DD) of merge, parsed from "Merged: YYYY-MM-DD (iter N)" field.
   * Null when the Merged field contains only an iteration number (no date).
   */
  mergedAt?: string | null;
  /**
   * Iteration number when item was merged, parsed from the Merged field.
   * Null when the Merged field is absent.
   */
  mergedIteration?: number | null;
}

export interface InboxQuestion {
  id: string;
  question: string;
  default?: string;
  options?: string[];
  context?: string;
  answered: boolean;
  answer?: string;
}

export interface SteeringDirective {
  text: string;
  timestamp?: string;
}

export interface ChangelogEntry {
  title: string;
  details: string;
  date?: string;
}

export type SessionRole = "cto" | "tester" | "documenter";

export interface SessionInfo {
  role: SessionRole;
  pid: number | null;
  status: "running" | "stalled" | "stopped";
  lastActivity: number | null;
  logFile: string;
}

export interface SessionStatus {
  cto: SessionInfo;
  tester: SessionInfo;
  documenter: SessionInfo;
}

export interface ProjectDetail {
  project: ProjectWithStatus;
  state: RedEyeState | null;
  currentTask: string | null;
  activeItem: TaskItem | null;
  pendingQuestions: InboxQuestion[];
  upNext: TaskItem[];
  recentlyShipped: TaskItem[];
  /**
   * All done items sorted by mergedIteration descending. Used by the Tasks
   * page to show the complete Done section with full pagination. Differs from
   * recentlyShipped which is sliced to 8 for the mission-control card.
   */
  allDoneItems: TaskItem[];
  /**
   * Items the team has decided not to ship. Carried separately because
   * upNext (planned/pending/in-progress) and recentlyShipped (done) both
   * exclude wont-do, so without a dedicated bucket the tasks page would
   * never render its Won't Do section.
   */
  wontDoItems: TaskItem[];
  recentChangelog: ChangelogEntry[];
  steeringDirectives: SteeringDirective[];
}

export interface ScheduleEntry {
  /** e.g. "SCHED-001" */
  id: string;
  title: string;
  /** Raw frequency string as written in schedules.md, e.g. "every 7d" */
  frequency: string;
  /** ISO 8601 string of last run, or null if never run / not specified */
  lastRunIso: string | null;
  /** Numbered step strings extracted from the Task list */
  steps: string[];
  /** Assigned role(s) string */
  assignedTo: string;
  /** Unix epoch ms of next due time; null if frequency cannot be parsed */
  nextDueMs: number | null;
  /** True if current time is past nextDueMs, or if never run with a parseable frequency */
  isOverdue: boolean;
}

export interface ClaudeStreamEvent {
  type: "system" | "assistant" | "user" | "result";
  subtype?: "text" | "thinking" | "tool_use" | "tool_result";
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  cost?: number;
  /**
   * Stable React key — populated by the normalizer (`lib/transcript-normalizer.ts`)
   * from the source envelope `id` (and content-block index) when available, or a
   * djb2-hash fallback otherwise. The synthetic `__session_boundary__` event from
   * `lib/stream-utils.ts` carries `_key = "__session_boundary__"`.
   *
   * The underscore prefix marks this as a client-side control field, NOT part
   * of the Claude API wire format. Optional so existing fixtures and mocks
   * continue to typecheck without modification. Consumed by `TranscriptViewer`
   * to keep collapsible card open-state stable across SSE replay / index shifts.
   *
   * Added in T147 to fix card-remount-on-replay flicker.
   */
  _key?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/** T113 — In-app notification system. */
export type NotificationType = "task-complete" | "task-error" | "needs-input";

export interface NotificationItem {
  /** Stable UUID — generated server-side at creation time. */
  id: string;
  type: NotificationType;
  /** Index into the registered projects array — used to build /project/:id links. */
  projectId: number;
  projectName: string;
  /** Human-readable summary, e.g. "T113 complete — merged to main". */
  message: string;
  /** ISO 8601 timestamp at creation. */
  timestamp: string;
  /** Snapshot of `state.task_id` at the moment the event fired. */
  taskId: string | null;
}
