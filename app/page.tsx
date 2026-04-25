"use client";

import { useEffect, useState, useCallback } from "react";
import type { ProjectWithStatus } from "@/lib/redeye-types";
import { ProjectCard } from "@/components/project-card";
import { AddProjectDialog } from "@/components/add-project-dialog";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";

const POLL_INTERVAL_MS = 10_000;

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setProjects(json.data);
    } catch (err) {
      // Only show error on initial load, not during polling
      if (projects.length === 0) {
        setFetchError("Failed to load projects. Check that the server is running.");
      }
    } finally {
      setLoading(false);
    }
  }, [projects.length]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return; // already running
      intervalId = setInterval(fetchProjects, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        fetchProjects(); // immediate refresh on tab focus
        startPolling();
      }
    };

    // Initial fetch on mount
    fetchProjects();

    // Start polling if the tab is currently visible
    if (document.visibilityState !== "hidden") {
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchProjects]);

  async function handleToggle(index: number) {
    const project = projects[index];
    const action = project.running ? "stop" : "start";
    try {
      await fetch(`/api/projects/${index}/${action}`, { method: "POST" });
      await fetchProjects();
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    await fetchProjects();
  }

  return (
    <main className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
            {projects.length} project{projects.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
        >
          Add Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading projects…
        </div>
      ) : fetchError ? (
        <FetchError message={fetchError} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<span>~</span>}
          title="No projects yet"
          subtitle="Add a project directory to start monitoring it with Control Tower."
          action={{ label: "Add your first project", onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, index) => (
            <ProjectCard
              key={`${project.name}-${index}`}
              project={project}
              index={index}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AddProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={fetchProjects}
      />
    </main>
  );
}
