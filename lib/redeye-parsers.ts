import type {
  BacklogItem,
  InboxQuestion,
  ChangelogEntry,
  SteeringDirective,
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

export function parseBacklog(content: string): BacklogItem[] {
  const sectionMap: Array<{
    header: string;
    section: BacklogItem["section"];
  }> = [
    { header: "## CEO Requests", section: "ceo" },
    { header: "## Discovered", section: "discovered" },
    { header: "## Triaged", section: "triaged" },
    { header: "## Won't Do", section: "wontdo" },
  ];

  const items: BacklogItem[] = [];

  for (const { header, section } of sectionMap) {
    const sectionContent = extractSection(content, header);
    if (!sectionContent) continue;

    const blocks = extractItemBlocks(sectionContent);

    for (const { header: itemHeader, body } of blocks) {
      const headerMatch = itemHeader.match(/^### (BL-\d+):\s*(.+)$/);
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
      });
    }
  }

  // Deduplicate by id — if the same BL-xxx appears in multiple sections,
  // keep the last occurrence (later sections are more specific/updated).
  const seen = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    seen.set(items[i].id, i);
  }
  const deduped = items.filter((item, i) => seen.get(item.id) === i);

  return deduped;
}

function normalizeStatus(raw: string | undefined): BacklogItem["status"] {
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

    const builtMatch = details.match(/\*\*Built:\*\*\s*(?:BL-\d+\s*[-—]\s*)?(.+)/);
    const displayTitle = builtMatch ? builtMatch[1].trim() : title;

    entries.push({ title: displayTitle, details, date });
  }

  return entries;
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
