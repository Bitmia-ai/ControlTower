"use client";

// Opt out of static prerendering — all data is fetched client-side anyway.
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import type { ProjectWithStatus } from "@/lib/redeye-types";
import { ProjectCard } from "@/components/project-card";
import { AddProjectDialog } from "@/components/add-project-dialog";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { HomeOnboardingWizard } from "@/components/home-onboarding-wizard";
import { InstallBanner } from "@/components/install-banner";

const ONBOARDING_DISMISS_KEY = "ct_onboarding_dismissed";

const POLL_INTERVAL_MS = 10_000;

export default function HomeClient() {
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // SSR-safe: read localStorage only after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === "true") {
        setOnboardingDismissed(true);
      }
    } catch {
      // ignore — private mode or quota
    }
  }, []);

  // Track project count via ref so the polling callback's identity stays
  // stable; otherwise the interval is recreated after every successful fetch.
  const projectsCountRef = useRef(projects.length);
  useEffect(() => { projectsCountRef.current = projects.length; }, [projects.length]);

  const fetchProjects = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setProjects(json.data);
    } catch {
      // Only show error on initial load, not during polling
      if (projectsCountRef.current === 0) {
        setFetchError("Failed to load projects. Check that the server is running.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
    <>
      {/* PWA install nudge — only shows when browser fires beforeinstallprompt */}
      <InstallBanner />
      <main className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between gap-4 mb-8 pb-5 border-b border-gray-200 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
            Control Tower
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
            Projects
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="shrink-0 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
        >
          Add Project
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading projects…
        </div>
      ) : fetchError ? (
        <FetchError message={fetchError} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        !onboardingDismissed ? (
          <HomeOnboardingWizard
            onProjectAdded={fetchProjects}
            onDismiss={() => setOnboardingDismissed(true)}
          />
        ) : (
          <EmptyState
            icon={<FolderOpen className="h-5 w-5" />}
            title="Welcome to Control Tower"
            subtitle={
              <span>
                Add your first project — point it at a git repo that has{" "}
                <a
                  href="https://github.com/Bitmia-ai/RedEye"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:underline"
                >
                  RedEye
                </a>{" "}
                installed, or run{" "}
                <code className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
                  /redeye:init
                </code>{" "}
                in Claude Code to scaffold it. See the{" "}
                <a
                  href="https://github.com/Bitmia-ai/ControlTower#quick-start"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:underline"
                >
                  Quick Start
                </a>{" "}
                for setup steps.
              </span>
            }
            action={{ label: "Add your first project", onClick: () => setDialogOpen(true) }}
          />
        )
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
    </>
  );
}
