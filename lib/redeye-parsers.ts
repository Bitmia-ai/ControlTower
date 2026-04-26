import type {
  TaskItem,
  InboxQuestion,
  ChangelogEntry,
  SteeringDirective,
  ScheduleEntry,
} from "./redeye-types";

/** Extract content between a ## header and the next ## header (or EOF). */
function extractSection(raw: string, header: string): string | null {
  const idx = raw.indexOf(header);
  if (idx === -1) return null;

  const afterHeader = raw.substring(idx + header.length);
  const nextSection = afterHeader.match(/\n## (?!#)/);
  const end = nextSection ? nextSection.index! : afterHeader.length;
  return afterHeader.substring(0, end);
}

/** Split a section into { header, body } pairs on ### boundaries. */
function extractItemBlocks(
  sectionContent: string
): Array<{ header: string; body: string }> {
  const results: Array<{ header: string; body: string }> = [];

  const headerRegex = /^(### .+)$/gm;
  const headerMatches: Array<{ index: number; header: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = headerRegex.exec(sectionContent)) !== null) {
    headerMatches.push({ index: m.index, header: m[1] });
  }

  for (let i = 0; i < headerMatches.length; i++) {
    const { index, header } = headerMatches[i];
    const bodyStart = index + header.length;
    const bodyEnd =
      i + 1 < headerMatches.length
        ? headerMatches[i + 1].index
        : sectionContent.length;
    const body = sectionContent.substring(bodyStart, bodyEnd);
    results.push({ header, body });
  }

  return results;
}

/** Pick a field value from a `- **FieldName:** value` line. */
function pickField(body: string, fieldName: string): string | undefined {
  const re = new RegExp(`^- \\*\\*${fieldName}:\\*\\* ([^\\n]+)`, "m");
  const match = body.match(re);
  return match?.[1]?.trim();
}

export function parseTasks(content: string): TaskItem[] {
  const sectionMap: Array<{
    header: string;
    section: TaskItem["section"];
  }> = [
    { header: "## CEO Requests", section: "ceo" },
    { header: "## Discovered", section: "discovered" },
    { header: "## Triaged", section: "triaged" },
    { header: "## Won't Do", section: "wontdo" },
  ];

  const items: TaskItem[] = [];

  for (const { header, section } of sectionMap) {
    const sectionContent = extractSection(content, header);
    if (!sectionContent) continue;

    const blocks = extractItemBlocks(sectionContent);

    for (const { header: itemHeader, body } of blocks) {
      const headerMatch = itemHeader.match(/^### (T\d+):\s*(.+)$/);
      if (!headerMatch) continue;

      const [, id, title] = headerMatch;
      const rawStatus = pickField(body, "Status");
      const status = normalizeStatus(rawStatus);

      let details: string | undefined;
      const detailsMatch = body.match(/- \*\*Details:\*\*\s*\n([\s\S]*?)(?=\n- \*\*|\s*$)/);
      if (detailsMatch) {
        const rawDetails = detailsMatch[1];
        const lines = rawDetails
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("- "))
          .map((l) => l);
        if (lines.length > 0) details = lines.join("\n");
      }

      items.push({
        id,
        title: title.trim(),
        type: pickField(body, "Type"),
        priority: pickField(body, "Priority"),
        status,
        section,
        details,
        spec: pickField(body, "Spec"),
        summary: pickField(body, "Summary"),
        reason: pickField(body, "Reason"),
      });
    }
  }

  // Deduplicate by id — if the same TXXX appears in multiple sections,
  // keep the last occurrence (later sections are more specific/updated).
  const seen = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    seen.set(items[i].id, i);
  }
  const deduped = items.filter((item, i) => seen.get(item.id) === i);

  return deduped;
}

function normalizeStatus(raw: string | undefined): TaskItem["status"] {
  if (!raw) return "pending";
  const lower = raw.toLowerCase();
  if (lower === "pending") return "pending";
  if (lower === "planned") return "planned";
  if (lower === "in-progress" || lower === "in progress") return "in-progress";
  if (lower === "done" || lower === "complete" || lower === "completed")
    return "done";
  if (lower === "blocked") return "blocked";
  if (lower === "pending-triage" || lower === "pending triage")
    return "pending-triage";
  if (lower === "wont-do" || lower === "wontdo" || lower === "won't do")
    return "wontdo";
  return "pending";
}

export function parseInbox(content: string): InboxQuestion[] {
  const questions: InboxQuestion[] = [];

  // Open questions
  const openSection = extractSection(content, "## Questions (Open)");
  if (openSection) {
    for (const { header, body } of extractItemBlocks(openSection)) {
      const q = parseInboxItem(header, body, false);
      if (q) questions.push(q);
    }
  }

  // Answered questions
  const answeredSection = extractSection(content, "## Answered / Provided");
  if (answeredSection) {
    for (const { header, body } of extractItemBlocks(answeredSection)) {
      const q = parseInboxItem(header, body, true);
      if (q) questions.push(q);
    }
  }

  return questions;
}

function parseInboxItem(
  header: string,
  body: string,
  answered: boolean
): InboxQuestion | null {
  // ### Q-001: optional title text (colon may be present with or without a title)
  const headerMatch = header.match(/^### (Q-\d+)(?::(?:\s*(.+))?)?$/);
  if (!headerMatch) return null;

  const [, id, headerTitle] = headerMatch;

  // Question text may be in a **Question:** field or inline after the header
  const questionField = pickField(body, "Question");
  const question = questionField ?? headerTitle?.trim() ?? "";

  // Options: comma-separated or bullet list
  const optionsRaw = pickField(body, "Options");
  const options = optionsRaw
    ? optionsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    id,
    question,
    default: pickField(body, "Default"),
    options,
    context: pickField(body, "Context"),
    answered,
    answer: pickField(body, "Answer"),
  };
}

export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  const iterationRegex = /^## (Iteration \d+(?:\s*—\s*[^\n]+)?)\s*$/gm;
  const headerMatches: Array<{ index: number; title: string; date?: string }> =
    [];
  let m: RegExpExecArray | null;

  while ((m = iterationRegex.exec(content)) !== null) {
    const raw = m[1];
    const dashIdx = raw.indexOf("—");
    const title =
      dashIdx !== -1 ? raw.substring(0, dashIdx).trim() : raw.trim();
    const date =
      dashIdx !== -1 ? raw.substring(dashIdx + 1).trim() : undefined;
    headerMatches.push({ index: m.index, title, date });
  }

  for (let i = 0; i < headerMatches.length; i++) {
    const { index, title, date } = headerMatches[i];
    const headerEnd = content.indexOf("\n", index);
    const bodyStart = headerEnd !== -1 ? headerEnd + 1 : index;
    const bodyEnd =
      i + 1 < headerMatches.length
        ? headerMatches[i + 1].index
        : content.length;

    const rawBody = content.substring(bodyStart, bodyEnd).trim();
    const details = rawBody.replace(/^---\s*/m, "").trim();

    const builtMatch = details.match(/\*\*Built:\*\*\s*(?:T\d+\s*[-—]\s*)?(.+)/);
    const displayTitle = builtMatch ? builtMatch[1].trim() : title;

    entries.push({ title: displayTitle, details, date });
  }

  return entries;
}

/**
 * Parse duration string like "every 7d", "every 2h", "every 1w" -> milliseconds.
 * Returns null for unrecognised formats.
 */
export function parseDurationMs(frequency: string): number | null {
  const match = frequency.match(/every\s+(\d+(?:\.\d+)?)\s*([hdw])/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "h") return n * 3600 * 1000;
  if (unit === "d") return n * 86400 * 1000;
  if (unit === "w") return n * 7 * 86400 * 1000;
  return null;
}

/**
 * Parse `.redeye/schedules.md` content into a list of ScheduleEntry objects.
 * Each entry corresponds to a `### SCHED-{id}: {title}` block.
 */
export function parseSchedules(
  content: string,
  nowMs: number = Date.now()
): ScheduleEntry[] {
  if (!content) return [];

  // Find all ### SCHED-{id}: {title} blocks anywhere in the content
  const headerRegex = /^(### (SCHED-\d+):\s*(.+))$/gm;
  const headerMatches: Array<{ index: number; id: string; title: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = headerRegex.exec(content)) !== null) {
    headerMatches.push({
      index: m.index,
      id: m[2],
      title: m[3].trim(),
    });
  }

  return headerMatches.map(({ index, id, title }, i) => {
    const bodyStart = content.indexOf("\n", index) + 1;
    const bodyEnd =
      i + 1 < headerMatches.length
        ? headerMatches[i + 1].index
        : content.length;
    const body = content.substring(bodyStart, bodyEnd);

    const frequency = pickField(body, "Frequency") ?? "";
    const lastRunRaw = pickField(body, "Last run");
    const lastRunIso =
      lastRunRaw && lastRunRaw !== "{ISO timestamp}" && lastRunRaw !== "—"
        ? lastRunRaw
        : null;
    const assignedTo = pickField(body, "Assigned to") ?? "";

    // Parse numbered steps from the Task: block
    const steps: string[] = [];
    const taskFieldIdx = body.indexOf("- **Task:**");
    if (taskFieldIdx !== -1) {
      const afterTask = body.substring(taskFieldIdx + "- **Task:**".length);
      // Stop at the next `- **` field or end of body
      const nextFieldMatch = afterTask.search(/\n- \*\*/);
      const stepsBlock =
        nextFieldMatch !== -1
          ? afterTask.substring(0, nextFieldMatch)
          : afterTask;

      const stepRegex = /^\s+(\d+)\.\s+(.+)$/gm;
      let sm: RegExpExecArray | null;
      while ((sm = stepRegex.exec(stepsBlock)) !== null) {
        steps.push(sm[2].trim());
      }
    }

    // Compute nextDueMs and isOverdue
    const durationMs = parseDurationMs(frequency);
    let nextDueMs: number | null = null;
    let isOverdue = false;

    if (durationMs !== null) {
      if (lastRunIso) {
        const lastRunMs = Date.parse(lastRunIso);
        if (!isNaN(lastRunMs)) {
          nextDueMs = lastRunMs + durationMs;
          isOverdue = nowMs > nextDueMs;
        } else {
          // Unparseable date -- treat as never run
          nextDueMs = 0;
          isOverdue = true;
        }
      } else {
        // Never run
        nextDueMs = 0;
        isOverdue = true;
      }
    }

    return {
      id,
      title,
      frequency,
      lastRunIso,
      steps,
      assignedTo,
      nextDueMs,
      isOverdue,
    };
  });
}

export function parseSteering(content: string): SteeringDirective[] {
  const section = extractSection(content, "## Directives");
  if (!section) return [];

  const directives: SteeringDirective[] = [];

  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    const text = trimmed.substring(2).trim();
    if (!text || text.startsWith("_(")) continue;

    directives.push({ text });
  }

  return directives;
}

/**
 * Locate the absolute line indices (within the full file split by `\n`) of
 * directives in the `## Directives` section, in the same order and with the
 * same skip rules as `parseSteering`. Used by the edit/delete helpers below
 * so the API can address directives by their parsed-array index without the
 * caller having to know the file's line layout.
 */
function findDirectiveLineIndices(content: string): number[] {
  const headerIdx = content.indexOf("## Directives");
  if (headerIdx === -1) return [];

  // Compute the byte range of the section (header through next `## ` or EOF),
  // then map back to absolute line indices in the original file.
  const afterHeader = content.substring(headerIdx + "## Directives".length);
  const nextSection = afterHeader.match(/\n## (?!#)/);
  const sectionEndAbs =
    headerIdx +
    "## Directives".length +
    (nextSection ? nextSection.index! : afterHeader.length);

  const lines = content.split("\n");
  const indices: number[] = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineStart = cursor;
    const lineEnd = cursor + lines[i].length; // not including trailing \n
    cursor = lineEnd + 1; // advance past \n

    // Only consider lines that fall inside the directives section (after the
    // header, before the next ## section).
    if (lineStart < headerIdx) continue;
    if (lineStart >= sectionEndAbs) break;

    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("- ")) continue;
    const text = trimmed.substring(2).trim();
    if (!text || text.startsWith("_(")) continue;

    indices.push(i);
  }
  return indices;
}

/**
 * Replace the Nth parsed directive (matching `parseSteering` indexing) with
 * `- {newText}`, preserving leading indentation of the original bullet and
 * the rest of the file byte-for-byte.
 *
 * `newText` MUST already be sanitized (single-line, no control chars) — the
 * caller (API route) runs `sanitizeMarkdownInput` before calling this.
 *
 * Throws RangeError when `index` is out of range.
 */
export function applyDirectiveEdit(
  content: string,
  index: number,
  newText: string
): string {
  const indices = findDirectiveLineIndices(content);
  if (index < 0 || index >= indices.length) {
    throw new RangeError("directive index out of range");
  }
  const lineIdx = indices[index];
  const lines = content.split("\n");
  const original = lines[lineIdx];
  const indentMatch = original.match(/^(\s*)-\s/);
  const indent = indentMatch ? indentMatch[1] : "";
  lines[lineIdx] = `${indent}- ${newText}`;
  return lines.join("\n");
}

/**
 * Remove the Nth parsed directive line entirely (and its trailing newline),
 * leaving every other line of the file untouched.
 *
 * Throws RangeError when `index` is out of range.
 */
export function applyDirectiveDelete(content: string, index: number): string {
  const indices = findDirectiveLineIndices(content);
  if (index < 0 || index >= indices.length) {
    throw new RangeError("directive index out of range");
  }
  const lineIdx = indices[index];
  const lines = content.split("\n");
  lines.splice(lineIdx, 1);
  return lines.join("\n");
}
