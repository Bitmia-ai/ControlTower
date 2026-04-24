"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PhaseBadge } from "./phase-badge";
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

  return (
    <div
      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5 hover:border-gray-300 dark:hover:border-zinc-700 cursor-pointer transition"
      onClick={() => router.push(`/project/${index}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 truncate">
              {project.name}
            </h2>
            {questionCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold h-5 min-w-[1.25rem] px-1">
                {questionCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-500 truncate mb-3">{project.path}</p>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3 truncate">
            {currentTask ?? "No active task"}
          </p>
          <PhaseBadge phase={project.phase} running={project.running} backlogEmpty={backlogEmpty} />
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                project.initialized ? "bg-green-500" : "bg-gray-400 dark:bg-zinc-600"
              }`}
              title={project.initialized ? "Initialized" : "Not initialized"}
            />
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete((v) => !v); }}
              title="Remove project"
              className="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition p-0.5"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {confirmDelete && (
            <div
              className="flex flex-col items-end gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-gray-600 dark:text-zinc-400 text-right max-w-[140px]">
                Remove {project.name} from Control Tower?
              </p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 text-right max-w-[140px]">
                Project files won&apos;t be deleted.
              </p>
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded transition disabled:opacity-50"
                >
                  {deleting ? "Removing…" : "Remove"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-300 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition disabled:opacity-60 disabled:cursor-not-allowed ${
              project.running
                ? "bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 text-gray-700 dark:text-zinc-200"
                : "bg-red-600 hover:bg-red-500 text-white"
            }`}
          >
            {stopping ? "Stopping…" : project.running ? "Stop" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
