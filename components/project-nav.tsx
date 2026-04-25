"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", path: "" },
  { label: "Backlog", path: "/backlog" },
  { label: "History", path: "/history" },
  { label: "Live", path: "/live" },
  { label: "Schedules", path: "/schedules" },
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
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
    <nav className="flex gap-4 border-b border-gray-200 dark:border-zinc-800 pb-0 overflow-x-auto">
      {NAV_ITEMS.map(({ label, path }) => (
        <Link
          key={label}
          href={basePath + path}
          className={`text-sm pb-3 px-0.5 transition border-b-2 whitespace-nowrap ${
            isActive(path)
              ? "border-red-600 text-gray-900 dark:text-zinc-100 font-medium"
              : "border-transparent text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
