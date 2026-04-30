import Link from "next/link";
import type { TaskItem } from "@/lib/redeye-types";
import { TaskId } from "@/components/task-id";
import { SectionHeader } from "@/components/section-header";
import { PRIORITY_COLORS } from "@/lib/task-badge-styles";

export function ActiveTaskCard({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div>
      <SectionHeader label="Currently Working On" className="mb-3" />
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-4 border-l-2 border-l-green-500">
        <div className="flex items-start gap-3">
          <div className="mt-1.5 flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse block" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 dark:text-zinc-100 leading-snug font-medium">
              <TaskId
                id={item.id}
                projectId={projectId}
                className="text-xs text-gray-400 dark:text-zinc-500 mr-1.5 font-normal"
              />
              <Link
                href={`/project/${projectId}/tasks/${item.id}`}
                className="hover:text-red-600 dark:hover:text-red-400 transition"
              >
                {item.title}
              </Link>
            </p>
            {item.type && (
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5 font-normal">{item.type}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {item.priority && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  PRIORITY_COLORS[item.priority] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                {item.priority}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 font-medium">
              in-progress
            </span>
            <Link
              href={`/project/${projectId}/live`}
              className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition"
            >
              View Live
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
