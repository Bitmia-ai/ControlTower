import type { TaskItem } from "@/lib/redeye-types";
import { AUTHOR_BADGE_STYLES, taskAuthor } from "@/lib/task-badge-styles";

export const BACKLOG_PAGE_SIZE = 20;
export const DONE_PAGE_SIZE = 25;

/**
 * Parse the numeric portion of a T-prefixed id. Used for sorting items newest-first.
 * Falls back to 0 if the id is malformed.
 */
export function parseTaskIdNumber(id: string): number {
  const match = id.match(/T(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) || 0;
}

export function taskSearchFn(item: TaskItem, query: string): boolean {
  const author = AUTHOR_BADGE_STYLES[taskAuthor(item.section)].label.toLowerCase();
  return (
    item.id.toLowerCase().includes(query) ||
    item.title.toLowerCase().includes(query) ||
    (item.type?.toLowerCase().includes(query) ?? false) ||
    author.includes(query)
  );
}

export const taskFilterFns: Record<string, (item: TaskItem, v: string) => boolean> = {
  priority: (item, v) => item.priority === v,
  status: (item, v) => item.status === v,
  author: (item, v) => taskAuthor(item.section) === v,
};
