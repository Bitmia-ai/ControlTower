import Link from "next/link";
import { Check, X } from "lucide-react";
import type { TaskItem } from "@/lib/redeye-types";
import { TaskId } from "@/components/task-id";
import { SectionHeader } from "@/components/section-header";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/task-badge-styles";

export function TaskSection({
  label,
  items,
  projectId,
}: {
  label?: string;
  items: TaskItem[];
  projectId: number;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {label && <SectionHeader label={label} count={items.length} className="mb-3" />}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-transparent rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-zinc-100 leading-snug">
                <TaskId
                  id={item.id}
                  projectId={projectId}
                  className="text-xs text-gray-400 dark:text-zinc-500 mr-1.5"
                />
                <Link
                  href={`/project/${projectId}/tasks/${item.id}`}
                  className="hover:text-red-600 dark:hover:text-red-400 transition"
                >
                  {item.title}
                </Link>
              </p>
              {item.type && (
                <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">{item.type}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {item.status === "done" && item.cost_usd !== undefined && item.cost_usd > 0 && (
                <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono">
                  ${item.cost_usd.toFixed(2)}
                </span>
              )}
              {item.priority && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    PRIORITY_COLORS[item.priority] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {item.priority}
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DoneItemRow({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
      <Check
        className="w-3.5 h-3.5 text-green-500 dark:text-green-400 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <TaskId
            id={item.id}
            projectId={projectId}
            className="text-xs text-gray-400 dark:text-zinc-600 mr-1.5"
          />
          <Link
            href={`/project/${projectId}/tasks/${item.id}`}
            className="text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition"
          >
            {item.title}
          </Link>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.cost_usd !== undefined && item.cost_usd > 0 && (
          <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono tabular-nums">
            ${item.cost_usd.toFixed(2)}
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400">
          done
        </span>
      </div>
    </div>
  );
}

export function WontDoItemRow({
  item,
  projectId,
}: {
  item: TaskItem;
  projectId: number;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors">
      <X
        className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600 mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <TaskId
            id={item.id}
            projectId={projectId}
            className="text-xs text-gray-400 dark:text-zinc-600 mr-1.5"
          />
          <Link
            href={`/project/${projectId}/tasks/${item.id}`}
            className="text-gray-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition line-through decoration-gray-300 dark:decoration-zinc-600"
          >
            {item.title}
          </Link>
        </p>
        {item.reason && (
          <p
            data-testid="wontdo-reason"
            className="text-xs text-gray-500 dark:text-zinc-500 mt-1 leading-snug"
          >
            <span className="font-mono uppercase tracking-[0.14em] text-[10px] text-gray-400 dark:text-zinc-600 mr-1.5">
              Reason
            </span>
            {item.reason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500">
          won&apos;t do
        </span>
      </div>
    </div>
  );
}
