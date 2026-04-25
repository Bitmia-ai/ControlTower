"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProjectNav } from "@/components/project-nav";

interface ProjectInfo {
  name: string;
  running: boolean;
  path?: string;
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [project, setProject] = useState<ProjectInfo | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const json = await res.json();
      if (json.data?.project) {
        setProject({
          name: json.data.project.name,
          running: json.data.project.running ?? false,
          path: json.data.project.path,
        });
      }
    } catch {
      // ignore polling errors
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(fetchProject, 5_000);
    return () => clearInterval(interval);
  }, [fetchProject]);

  const projectName = project?.name ?? "Project";
  const running = project?.running ?? false;

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 pt-6 max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition mb-4 inline-flex items-center gap-1"
        >
          <span>&larr;</span>
          <span>All projects</span>
        </Link>

        <header className="pt-2 pb-4">
          <div className="flex items-end justify-between gap-4 pb-4 border-b border-gray-200 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
                Control Tower
              </p>
              <div className="flex items-center gap-3">
                {running && (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                )}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight truncate">
                  {projectName}
                </h1>
              </div>
              {project?.path && (
                <p className="font-mono text-[11px] text-gray-500 dark:text-zinc-500 mt-1 truncate">
                  {project.path}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                running
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-400"
                  : "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-500"
              }`}
            >
              {running ? "Running" : "Idle"}
            </span>
          </div>
        </header>

        <div className="mt-4 mb-6">
          <ProjectNav projectId={id} />
        </div>
      </div>
      {children}
    </div>
  );
}
