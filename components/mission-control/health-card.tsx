"use client";

import type { RedEyeState } from "@/lib/redeye-types";

interface HealthCardProps {
  state: RedEyeState | null;
  recentlyShippedCount: number;
}

function deriveHealth(state: RedEyeState | null): {
  label: string;
  reason: string;
  color: string;
  border: string;
} {
  if (!state) return { label: "No data", reason: "", color: "text-gray-500 dark:text-zinc-500", border: "border-l-gray-400 dark:border-l-zinc-600" };

  const confidence = state.health?.confidence ?? "LOW";
  const env = state.health?.env_status ?? "unknown";
  const reasons: string[] = [];

  if (env === "unhealthy") reasons.push("Environment unhealthy (build or tests failing)");
  if (confidence === "LOW") reasons.push("Low confidence — may need intervention");
  if (env === "unknown") reasons.push("Environment status unknown — no deploys yet");
  if ((state.health?.blocked_items_count ?? 0) > 0) reasons.push(`${state.health.blocked_items_count} blocked item(s)`);
  if ((state.health?.questions_awaiting_ceo ?? 0) > 0) reasons.push(`${state.health.questions_awaiting_ceo} question(s) awaiting answer`);

  if (env === "unhealthy" || confidence === "LOW") {
    return { label: "Unhealthy", reason: reasons.join(" · "), color: "text-red-600 dark:text-red-400", border: "border-l-red-600" };
  }
  if (confidence === "MEDIUM") {
    return { label: "Degraded", reason: reasons.join(" · "), color: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" };
  }
  return { label: "Healthy", reason: "", color: "text-green-600 dark:text-green-400", border: "border-l-green-500" };
}

export function HealthCard({ state, recentlyShippedCount }: HealthCardProps) {
  const { label, reason, color, border } = deriveHealth(state);
  const questionsWaiting = state?.health?.questions_awaiting_ceo ?? 0;
  const blockedItems = state?.health?.blocked_items_count ?? 0;

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 ${border} rounded-lg p-5`}>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-3">Health</p>

      <div className="space-y-3">
        <div>
          <span className={`text-base font-semibold ${color}`}>{label}</span>
          {reason && (
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{reason}</p>
          )}
        </div>

        <div className="flex gap-4 text-xs text-gray-500 dark:text-zinc-500 flex-wrap">
          <span>
            <span className="text-gray-700 dark:text-zinc-300 font-medium">{recentlyShippedCount}</span> shipped
          </span>
          {questionsWaiting > 0 && (
            <span>
              <span className="text-amber-500 dark:text-amber-400 font-medium">{questionsWaiting}</span>{" "}
              question{questionsWaiting !== 1 ? "s" : ""} waiting
            </span>
          )}
          {blockedItems > 0 && (
            <span>
              <span className="text-red-600 dark:text-red-400 font-medium">{blockedItems}</span> blocked
            </span>
          )}
          {questionsWaiting === 0 && blockedItems === 0 && (
            <span className="text-gray-400 dark:text-zinc-600">No blockers</span>
          )}
        </div>
      </div>
    </div>
  );
}
