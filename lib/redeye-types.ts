export interface Project {
  name: string;
  path: string;
}

export interface ProjectWithStatus extends Project {
  initialized: boolean;
  running: boolean;
  sessionStatus?: SessionStatus;
  phase?: string;
  currentTask?: string | null;
  questionCount?: number;
}

export interface RedEyeState {
  iteration: number;
  phase: Phase;
  phase_status: PhaseStatus;
  backlog_item: string | null;
  backlog_title: string | null;
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
    next_bl_id: number;
    next_q_id: number;
  };
  /** Cost in USD per completed backlog item, keyed by BL-xxx. Append-only. */
  item_costs?: Record<string, number>;
  /** Session cost at task start, keyed by BL-xxx. Used for delta calculation. */
  item_cost_starts?: Record<string, number>;
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

export interface BacklogItem {
  id: string;
  title: string;
  type?: string;
  priority?: string;
  status: "pending" | "planned" | "in-progress" | "done" | "blocked" | "pending-triage";
  section: "ceo" | "discovered" | "triaged" | "wontdo";
  details?: string;
  spec?: string;
  /** Estimated cost in USD for this item. Set at completion time via cost-snapshot API. */
  cost_usd?: number;
  /** Single-line LLM-authored summary of what shipped. Written by CTO at VERIFY time. */
  summary?: string;
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
  activeItem: BacklogItem | null;
  pendingQuestions: InboxQuestion[];
  upNext: BacklogItem[];
  recentlyShipped: BacklogItem[];
  recentChangelog: ChangelogEntry[];
  steeringDirectives: SteeringDirective[];
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
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
