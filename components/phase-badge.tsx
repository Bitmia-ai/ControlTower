"use client";

import { getPhaseLabel } from "@/lib/redeye-types";

export function PhaseBadge({
  phase,
  running,
  noTasks,
}: {
  phase?: string;
  running: boolean;
  noTasks?: boolean;
}) {
  const showNoTasks = !running && noTasks;
  const label = showNoTasks
    ? "No tasks"
    : phase
      ? getPhaseLabel(phase)
      : "Idle";
  const dotColor = running
    ? "bg-green-500"
    : showNoTasks
      ? "bg-amber-500"
      : "bg-gray-400 dark:bg-zinc-500";
  const textColor = showNoTasks
    ? "text-amber-600 dark:text-amber-400"
    : "text-gray-500 dark:text-zinc-400";
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${textColor}`}>
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
