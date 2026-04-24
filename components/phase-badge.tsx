"use client";

import { PHASE_LABELS } from "@/lib/redeye-types";

export function PhaseBadge({
  phase,
  running,
  backlogEmpty,
}: {
  phase?: string;
  running: boolean;
  backlogEmpty?: boolean;
}) {
  const showBacklogEmpty = !running && backlogEmpty;
  const label = showBacklogEmpty
    ? "Backlog empty"
    : phase
      ? PHASE_LABELS[phase] ?? phase
      : "Idle";
  const dotColor = running
    ? "bg-green-500"
    : showBacklogEmpty
      ? "bg-amber-500"
      : "bg-gray-400 dark:bg-zinc-500";
  const textColor = showBacklogEmpty
    ? "text-amber-600 dark:text-amber-400"
    : "text-gray-500 dark:text-zinc-400";
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${textColor}`}>
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
