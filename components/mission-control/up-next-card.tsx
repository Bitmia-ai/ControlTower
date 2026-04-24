"use client";

import { BacklogId } from "@/components/backlog-id";
import type { BacklogItem } from "@/lib/redeye-types";

interface UpNextCardProps {
  items: BacklogItem[];
  projectId?: number;
}

const statusDot: Record<string, string> = {
  pending: "bg-gray-400 dark:bg-zinc-600",
  planned: "bg-gray-500 dark:bg-zinc-500",
  "in-progress": "bg-amber-400",
  blocked: "bg-red-500",
  "pending-triage": "bg-gray-400 dark:bg-zinc-600",
  done: "bg-green-500",
};

export function UpNextCard({ items, projectId }: UpNextCardProps) {
  const upNext = items.slice(0, 3);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-3">
        Up Next
      </p>

      {upNext.length === 0 ? (
        <span className="text-gray-400 dark:text-zinc-600 text-sm">Nothing queued</span>
      ) : (
        <ul className="space-y-2.5">
          {upNext.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  statusDot[item.status] ?? "bg-gray-400 dark:bg-zinc-600"
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">
                  {projectId !== undefined ? (
                    <BacklogId id={item.id} projectId={projectId} className="text-gray-500 dark:text-zinc-500" />
                  ) : (
                    <span className="text-gray-500 dark:text-zinc-500 font-mono">{item.id}</span>
                  )}
                  {" · "}
                  {item.title}
                </p>
                {item.type && (
                  <span className="text-xs text-gray-400 dark:text-zinc-600 capitalize">
                    {item.type}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
