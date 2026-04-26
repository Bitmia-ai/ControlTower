"use client";

import { TaskId } from "@/components/task-id";
import { PHASE_LABELS, PHASE_COLORS } from "@/lib/redeye-types";
import type { RedEyeState } from "@/lib/redeye-types";

const DEFAULT_COLORS = { bg: "bg-gray-100 dark:bg-zinc-800", text: "text-gray-700 dark:text-zinc-300", shimmer: "from-gray-100 via-gray-200 to-gray-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800" };

interface WorkingOnCardProps {
  state: RedEyeState | null;
  running: boolean;
  projectId?: number;
  upNextCount?: number;
  openQuestionCount?: number;
}

function PhaseBadge({ phase, running }: { phase: string; running: boolean }) {
  const label = PHASE_LABELS[phase] ?? phase;
  const colors = PHASE_COLORS[phase] ?? DEFAULT_COLORS;
  const animate = running && colors.shimmer;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${colors.text} ${
        animate
          ? `bg-linear-to-r ${colors.shimmer} phase-badge-shimmer`
          : colors.bg
      }`}
    >
      {running && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-pulse" />}
      {label}
    </span>
  );
}

export function WorkingOnCard({ state, running, projectId, upNextCount, openQuestionCount }: WorkingOnCardProps) {
  const hasTask = state?.task_title;
  const isBacklogEmpty = !running && state?.phase === "HARDEN" && (upNextCount ?? 0) === 0;
  // RedEye exits the loop when blocked on questions (phase=waiting_for_ceo).
  // The dashboard must surface this clearly so the user knows their reply is
  // expected, and so they understand the loop will resume on answer.
  const isWaitingOnCeo =
    !running &&
    (state?.phase === "waiting_for_ceo" || (openQuestionCount ?? 0) > 0);

  const topBorder = running
    ? "border-t-green-500"
    : isWaitingOnCeo
    ? "border-t-amber-400"
    : "border-t-zinc-300 dark:border-t-zinc-700";

  // T067: Hero treatment — increase padding, min-height, and add subtle
  // green wash when the loop is actively running.
  const runningWash = running ? "bg-green-50/30 dark:bg-green-950/10" : "bg-white dark:bg-zinc-900";

  return (
    <div className={`${runningWash} border border-gray-200 dark:border-zinc-800 border-t-[3px] ${topBorder} rounded-lg p-6 min-h-[160px] h-full`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
        Working On
      </p>

      {!running && !hasTask ? (
        isWaitingOnCeo ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                RedEye stopped — waiting on your answer.
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-500 ml-4">
              {openQuestionCount && openQuestionCount > 0
                ? `${openQuestionCount} open question${openQuestionCount === 1 ? "" : "s"} in the inbox. Answering resumes the loop.`
                : "Answering the inbox question resumes the loop."}
            </p>
          </div>
        ) : isBacklogEmpty ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                RedEye stopped — task list empty.
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-500 ml-4">
              Add tasks to resume.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-zinc-600" />
            <span className="text-gray-500 dark:text-zinc-500 text-sm">RedEye is idle</span>
          </div>
        )
      ) : running && !hasTask && state?.phase ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-gray-700 dark:text-zinc-300 text-sm font-medium">
              {state.phase === "HARDEN" ? "Improving the codebase — finding tech debt, tests, docs" :
               state.phase === "STABILIZE" ? "Stabilizing — fixing broken environment" :
               state.phase === "TRIAGE" ? "Triaging — picking the next task" :
               state.phase === "INCORPORATE" ? "Incorporating your feedback" :
               state.phase === "SCHEDULES" ? "Running scheduled tasks" :
               "Starting up — analyzing project..."}
            </span>
          </div>
          <PhaseBadge phase={state.phase} running={running} />
        </div>
      ) : running && !hasTask ? (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-gray-600 dark:text-zinc-400 text-sm">Starting up — analyzing project...</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-500" />
            <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100 leading-snug">
              {projectId !== undefined && state?.task_id ? (
                <TaskId
                  id={state.task_id}
                  projectId={projectId}
                  className="text-gray-500 dark:text-zinc-500"
                />
              ) : (
                <span className="text-gray-500 dark:text-zinc-500 font-mono">{state?.task_id}</span>
              )}
              {state?.task_id && " · "}
              {state!.task_title}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {state?.phase && <PhaseBadge phase={state.phase} running={running} />}
            {state?.worktree_branch ? (
              <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
                {state.worktree_branch}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
