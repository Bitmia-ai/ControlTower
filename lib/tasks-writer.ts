// Pure markdown helper for the dashboard's "add CEO task" flow.
//
// Two API routes (`tasks/route.ts` and `schedules/run/route.ts`) need to insert
// a pending task entry directly under the `## CEO Requests` heading in
// `.redeye/tasks.md`. The duplicated splice logic was extracted into this
// shared, side-effect-free helper so any future schema change (new field,
// reordered lines, header rename) is applied in exactly one place.
//
// No file I/O — callers remain responsible for reading `tasks.md`, calling
// `appendCeoTask`, and writing the result back. Keeping the helper pure makes
// it trivially unit-testable with plain string fixtures (see tasks-writer.test.ts).

export interface TaskSpec {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  description?: string;
  schedule?: string;
}

const CEO_HEADER = "## CEO Requests";

/**
 * Pure function. Inserts a new markdown task block immediately after the
 * "## CEO Requests" heading in `content`. If the heading is absent, appends
 * a fresh "## CEO Requests" section at the end of the file (header + block).
 *
 * The generated block has the form:
 *   \n### {id}: {title}
 *   - **Type:** {type}
 *   - **Priority:** {priority}
 *   - **Status:** {status}
 *   [- **Description:** {description}]   ← only if description present
 *   [- **Schedule:** {schedule}]          ← only if schedule present
 *
 * Returns the updated content string. Callers handle file I/O.
 */
export function appendCeoTask(content: string, task: TaskSpec): string {
  const descLine =
    task.description && task.description.length > 0
      ? `- **Description:** ${task.description}\n`
      : "";
  const schedLine = task.schedule ? `- **Schedule:** ${task.schedule}\n` : "";
  const newItem = `\n### ${task.id}: ${task.title}\n- **Type:** ${task.type}\n- **Priority:** ${task.priority}\n- **Status:** ${task.status}\n${descLine}${schedLine}`;

  const ceoIdx = content.indexOf(CEO_HEADER);
  if (ceoIdx !== -1) {
    const insertAt = ceoIdx + CEO_HEADER.length;
    const nextLine = content.indexOf("\n", insertAt);
    if (nextLine === -1) {
      // Header is the final line with no trailing newline — append a newline
      // and the new block immediately after the header.
      return `${content}\n${newItem}`;
    }
    return content.slice(0, nextLine + 1) + newItem + content.slice(nextLine + 1);
  }
  // Fallback: header absent. Recreate it (mirrors the schedules/run route's
  // safer fallback per the spec) so subsequent calls find it.
  return `${content}\n${CEO_HEADER}\n${newItem}`;
}
