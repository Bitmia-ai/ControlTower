"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PHASE_LABELS, PHASE_COLORS } from "@/lib/redeye-types";
import type { ProjectWithStatus } from "@/lib/redeye-types";

interface ProjectCardProps {
  project: ProjectWithStatus;
  index: number;
  onToggle: (index: number) => void;
  onDelete?: (index: number) => void;
}

export function ProjectCard({ project, index, onToggle, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopping, setStopping] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/projects/${index}`, { method: "DELETE" });
      onDelete?.(index);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const questionCount = project.questionCount ?? 0;
  const currentTask = project.currentTask;
  const backlogEmpty = !project.running && project.phase === "HARDEN";

  // Status border: running > attention (questions) > idle
  let statusBorder = "border-t-zinc-300 dark:border-t-zinc-700";
  let statusKey: "running" | "attention" | "idle" = "idle";
  if (project.running) {
    statusBorder = "border-t-green-500";
    statusKey = "running";
  } else if (questionCount > 0) {
    statusBorder = "border-t-amber-400";
    statusKey = "attention";
  }

  // Phase footer styling: tinted from PHASE_COLORS, fall back to neutral
  const phaseColor = project.phase ? PHASE_COLORS[project.phase] : undefined;
  const phaseLabel = backlogEmpty
    ? "Backlog empty"
    : project.phase
      ? PHASE_LABELS[project.phase] ?? project.phase
      : "Idle";
  const phaseFooterClass = backlogEmpty
    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
    : phaseColor
      ? `${phaseColor.bg} ${phaseColor.text}`
      : "bg-gray-50 dark:bg-zinc-800/60 text-gray-600 dark:text-zinc-400";
  const phaseDotClass = project.running
    ? "bg-green-500"
    : backlogEmpty
      ? "bg-amber-500"
      : "bg-gray-400 dark:bg-zinc-500";

  return (
    <div
      data-status-border={statusKey}
      className={`group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 ${statusBorder} border-t-[3px] rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-zinc-700 cursor-pointer transition flex flex-col`}
      onClick={() => router.push(`/project/${index}`)}
    >
      {/* Body */}
      <div className="p-5 pb-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {/* Pulsing dot when running */}
              {project.running && (
                <span className="relative inline-flex shrink-0 h-2.5 w-2.5" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              )}
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 truncate">
                {project.name}
              </h2>
              {questionCount > 0 && (
                <span
                  className="shrink-0 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold h-5 min-w-[1.25rem] px-1"
                  title={`${questionCount} pending question${questionCount === 1 ? "" : "s"}`}
                >
                  {questionCount}
                </span>
              )}
            </div>
            <p
              data-testid="project-path"
              className="font-mono text-[11px] text-gray-500 dark:text-zinc-500 truncate mb-3"
            >
              {project.path}
            </p>
            <p className="text-sm text-gray-600 dark:text-zinc-400 truncate">
              {currentTask ?? "No active task"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                project.initialized ? "bg-green-500" : "bg-gray-400 dark:bg-zinc-600"
              }`}
              title={project.initialized ? "Initialized" : "Not initialized"}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete((v) => !v);
              }}
              aria-label={`Remove ${project.name}`}
              title="Remove project"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition p-1 -m-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Inline delete confirmation panel */}
        {confirmDelete && (
          <div
            data-testid="delete-confirm-panel"
            className="mt-3 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Remove {project.name}?
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
              Project files won&apos;t be deleted.
            </p>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition disabled:opacity-50 min-h-[44px]"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                }}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded transition min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phase footer strip */}
      <div
        data-testid="phase-footer"
        className={`flex items-center justify-between gap-2 px-5 py-2.5 border-t border-gray-100 dark:border-zinc-800 ${phaseFooterClass}`}
      >
        <span className="inline-flex items-center gap-2 text-xs font-medium">
          <span className={`h-2 w-2 rounded-full ${phaseDotClass}`} />
          {phaseLabel}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (project.running) {
              setStopping(true);
              setTimeout(() => setStopping(false), 3000);
            }
            onToggle(index);
          }}
          disabled={stopping}
          className={`text-xs font-medium px-3 py-1.5 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] ${
            project.running
              ? "bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-200"
              : "bg-red-600 hover:bg-red-500 text-white"
          }`}
        >
          {stopping ? "Stopping…" : project.running ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}
