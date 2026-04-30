/**
 * Format a YYYY-MM-DD date string as a human-readable relative time string.
 *
 * The date is parsed as midnight UTC for the given calendar day, then compared
 * against `nowMs` (defaults to `Date.now()`). This makes the function fully
 * testable without mocking `Date`.
 *
 * Output examples:
 *   "just now"     — less than 1 minute
 *   "5 min ago"    — 1–59 minutes
 *   "1 hour ago"   — 1 hour (singular)
 *   "3 hours ago"  — 2+ hours, same day
 *   "2 days ago"
 *   "1 week ago"
 *   "6 weeks ago"
 *   "2 months ago"
 *   "1 year ago"
 *
 * Returns `null` when `dateStr` is null, empty, or cannot be parsed.
 */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!dateStr) return null;

  // Parse YYYY-MM-DD as midnight UTC
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;

  const [, yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Validate month and day ranges before constructing the Date
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dateMs = Date.UTC(year, month - 1, day);

  if (isNaN(dateMs)) return null;

  const diffMs = nowMs - dateMs;

  // Negative diff = future date, treat as just now
  if (diffMs < 0) return "just now";

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30.44); // average days per month
  const diffYears = Math.floor(diffDays / 365.25);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 2) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 2) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks < 2) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`; // up to 4 weeks
  if (diffMonths < 2) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears < 2) return "1 year ago";
  return `${diffYears} years ago`;
}

/**
 * Format a millisecond timestamp as a human-readable relative time string,
 * supporting both past ("ago") and future ("from now") tense.
 *
 * Returns the literal `"—"` for `null` input — the sentinel used by the
 * Schedules UI when there is no `lastRunIso` or `nextDueMs`.
 *
 * Output format uses full-word units with correct singular/plural form:
 *   null               → "—"
 *   |diff| < 60 s      → "just now"
 *   |diff| < 60 min    → "N minute(s) [ago|from now]"
 *   |diff| < 24 h      → "N hour(s) [ago|from now]"
 *   |diff| < 14 days   → "N day(s) [ago|from now]"
 *   |diff| >= 14 days  → "N week(s) [ago|from now]"
 *
 * Capped at weeks; schedules in this project never span months or years.
 *
 * Note: the format intentionally differs from `formatRelativeTime` (which
 * uses short "min" / no plural). This matches the inline copy that previously
 * lived in `components/schedules/schedule-list.tsx` verbatim, so swapping the
 * two is behavior-preserving.
 */
export function formatRelativeMs(
  ms: number | null,
  nowMs: number = Date.now()
): string {
  if (ms === null) return "—";

  const diffMs = nowMs - ms;
  const absDiff = Math.abs(diffMs);
  const future = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(absDiff / (60 * 1000));
  const hours = Math.floor(absDiff / (3600 * 1000));
  const days = Math.floor(absDiff / (86400 * 1000));
  const weeks = Math.floor(absDiff / (7 * 86400 * 1000));

  if (seconds < 60) return "just now";

  const suffix = future ? "from now" : "ago";

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ${suffix}`;
  }
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ${suffix}`;
  }
  if (days < 14) {
    return `${days} day${days !== 1 ? "s" : ""} ${suffix}`;
  }
  return `${weeks} week${weeks !== 1 ? "s" : ""} ${suffix}`;
}
