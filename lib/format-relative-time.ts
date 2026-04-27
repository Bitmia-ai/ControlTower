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
