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
      <div className="px-4 sm:px-6 pt-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition mb-4 inline-flex items-center gap-1"
          >
            <span>&larr;</span>
            <span>All projects</span>
          </Link>

          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
              {projectName}
            </h1>
            {project?.path && (
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5 font-mono truncate max-w-full">
                {project.path}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  running
                    ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    running ? "bg-green-500 animate-pulse" : "bg-gray-400 dark:bg-zinc-600"
                  }`}
                />
                {running ? "Running" : "Stopped"}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <ProjectNav projectId={id} />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
