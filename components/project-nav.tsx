"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", path: "" },
  { label: "Tasks", path: "/tasks" },
  { label: "History", path: "/history" },
  { label: "Live", path: "/live" },
  { label: "Schedules", path: "/schedules" },
  { label: "Steer", path: "/steer" },
] as const;

interface ProjectNavProps {
  projectId: string;
  /** Count of open tasks (status = pending | planned). Badge shown when > 0. */
  openTaskCount?: number;
}

export function ProjectNav({ projectId, openTaskCount = 0 }: ProjectNavProps) {
  const rawPathname = usePathname();
  // During static prerendering, usePathname() may return null
  const pathname = rawPathname ?? "";
  const basePath = `/project/${projectId}`;

  function isActive(itemPath: string) {
    const fullPath = basePath + itemPath;
    if (itemPath === "") {
      // Overview: exact match only
      return pathname === basePath || pathname === basePath + "/";
    }
    // Other tabs: starts with match
    return pathname.startsWith(fullPath);
  }

  return (
    <div className="relative">
      <nav className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 pb-0 overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(({ label, path }) => (
          <Link
            key={label}
            href={basePath + path}
            className={`inline-flex items-center gap-1.5 text-sm pb-3 px-0.5 transition border-b-2 whitespace-nowrap ${
              isActive(path)
                ? "border-red-600 text-gray-900 dark:text-zinc-100 font-medium"
                : "border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
            }`}
          >
            {label}
            {label === "Tasks" && openTaskCount > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white min-w-[16px]"
                aria-label={`${openTaskCount} open tasks`}
              >
                {openTaskCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {/* Right-fade gradient — indicates horizontal overflow on narrow screens */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-gray-50 dark:from-zinc-950 to-transparent"
        aria-hidden="true"
        data-testid="nav-fade-gradient"
      />
    </div>
  );
}
