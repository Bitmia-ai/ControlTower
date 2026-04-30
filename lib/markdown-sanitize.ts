/**
 * lib/markdown-sanitize.ts
 *
 * User input that flows from API routes into `.redeye/*.md` files MUST be
 * sanitized before write. RedEye's autonomous CTO reads these files as
 * authoritative instructions; an unsanitized newline lets a user (or a
 * compromised browser tab — see CSRF risk) forge `## Headers`, `### TXXX`
 * tasks, or steering directives that the agent will then act on.
 *
 * This is the prompt-injection trust boundary for Control Tower.
 *
 * Strategy: replace newlines with spaces, strip control characters, and
 * neutralize markdown structural markers at line start.
 */

/**
 * Sanitize a single-line markdown value (titles, directives, answers).
 * Returns a string safe to interpolate directly into a markdown context
 * without breaking out into headers or lists.
 */
export function sanitizeMarkdownInput(input: string, opts: { maxLen?: number } = {}): string {
  const maxLen = opts.maxLen ?? 4096;
  let s = String(input);

  // Strip control chars (incl. CR/LF), normalize whitespace
  s = s.replace(/[\x00-\x08\x0B-\x1F\x7F\u2028\u2029]/g, "");
  s = s.replace(/[\r\n\t]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  // Truncate
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + "…";
  return s;
}

/**
 * Sanitize a multi-line markdown value (e.g. task description that
 * intentionally contains paragraphs). Preserves newlines but neutralizes
 * structural markers at line start: `#` → `\#`, `###` → `\###`, etc.
 */
export function sanitizeMarkdownBlock(input: string, opts: { maxLen?: number } = {}): string {
  const maxLen = opts.maxLen ?? 16384;
  let s = String(input);

  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u2028\u2029]/g, "");
  // Escape line-leading markers (headers, lists, blockquotes, hr) so they
  // can't be interpreted as new structural elements.
  s = s.replace(/^([ \t]*)([#>\-*+]|\d+\.)/gm, "$1\\$2");
  // Neutralize fence openers
  s = s.replace(/^(```|~~~)/gm, "\\$1");

  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + "…";
  return s;
}
