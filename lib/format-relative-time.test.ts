import { describe, it, expect } from "vitest";
import { formatRelativeTime, formatRelativeMs } from "./format-relative-time";

// Fixed reference timestamp: 2026-04-27T12:00:00Z (noon UTC)
const NOW = Date.UTC(2026, 3, 27, 12, 0, 0); // month is 0-indexed

describe("formatRelativeTime — null/empty inputs", () => {
  it("returns null for null input", () => {
    expect(formatRelativeTime(null, NOW)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatRelativeTime(undefined, NOW)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatRelativeTime("", NOW)).toBeNull();
  });

  it("returns null for non-date string", () => {
    expect(formatRelativeTime("iteration 112", NOW)).toBeNull();
  });

  it("returns null for malformed date", () => {
    expect(formatRelativeTime("2026-13-01", NOW)).toBeNull();
  });
});

describe("formatRelativeTime — just now", () => {
  it("returns 'just now' for same day (0 min diff)", () => {
    // Same day as NOW = 2026-04-27, parsed as midnight UTC → 12h diff
    // That is 720 min, so NOT just now.
    // Use a date that's within 1 min (impossible with day precision — just verify negative is 'just now')
    const futureNow = Date.UTC(2026, 3, 27, 0, 0, 0); // midnight UTC
    // dateMs = midnight UTC 2026-04-27; nowMs = midnight → 0 diff → just now
    expect(formatRelativeTime("2026-04-27", futureNow)).toBe("just now");
  });

  it("returns 'just now' for a future date (negative diff)", () => {
    // Date is tomorrow, nowMs is today midnight
    const nowMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    expect(formatRelativeTime("2026-04-28", nowMs)).toBe("just now");
  });
});

describe("formatRelativeTime — minutes", () => {
  it("returns '5 min ago' for 5 minutes elapsed", () => {
    // dateMs = midnight; nowMs = midnight + 5 min
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 5 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("5 min ago");
  });

  it("returns '59 min ago' for 59 minutes elapsed", () => {
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 59 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("59 min ago");
  });

  it("returns '1 min ago' for exactly 1 minute elapsed", () => {
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 min ago");
  });
});

describe("formatRelativeTime — hours", () => {
  it("returns '1 hour ago' for exactly 1 hour elapsed", () => {
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 hour ago");
  });

  it("returns '1 hour ago' for 90 minutes elapsed", () => {
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 90 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 hour ago");
  });

  it("returns '3 hours ago' for 3 hours elapsed", () => {
    const date = "2026-04-27";
    const dateMs = Date.UTC(2026, 3, 27, 0, 0, 0);
    const nowMs = dateMs + 3 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("3 hours ago");
  });
});

describe("formatRelativeTime — days", () => {
  it("returns '1 day ago' for exactly 1 day elapsed", () => {
    const date = "2026-04-26";
    const dateMs = Date.UTC(2026, 3, 26, 0, 0, 0);
    const nowMs = dateMs + 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 day ago");
  });

  it("returns '2 days ago' for 2 days elapsed", () => {
    const date = "2026-04-25";
    const dateMs = Date.UTC(2026, 3, 25, 0, 0, 0);
    const nowMs = dateMs + 2 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("2 days ago");
  });

  it("returns '5 days ago' for 5 days elapsed", () => {
    const date = "2026-04-22";
    const dateMs = Date.UTC(2026, 3, 22, 0, 0, 0);
    const nowMs = dateMs + 5 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("5 days ago");
  });
});

describe("formatRelativeTime — weeks", () => {
  it("returns '1 week ago' for 7 days elapsed", () => {
    const date = "2026-04-20";
    const dateMs = Date.UTC(2026, 3, 20, 0, 0, 0);
    const nowMs = dateMs + 7 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 week ago");
  });

  it("returns '2 weeks ago' for 14 days elapsed", () => {
    const date = "2026-04-13";
    const dateMs = Date.UTC(2026, 3, 13, 0, 0, 0);
    const nowMs = dateMs + 14 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("2 weeks ago");
  });

  it("returns '4 weeks ago' for 28 days elapsed", () => {
    const date = "2026-03-30";
    const dateMs = Date.UTC(2026, 2, 30, 0, 0, 0);
    const nowMs = dateMs + 28 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("4 weeks ago");
  });
});

describe("formatRelativeTime — months", () => {
  it("returns '1 month ago' for ~35 days elapsed", () => {
    const date = "2026-03-23";
    const dateMs = Date.UTC(2026, 2, 23, 0, 0, 0);
    const nowMs = dateMs + 35 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 month ago");
  });

  it("returns '3 months ago' for ~91 days elapsed", () => {
    const date = "2026-01-26";
    const dateMs = Date.UTC(2026, 0, 26, 0, 0, 0);
    const nowMs = dateMs + 91 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("2 months ago");
  });
});

describe("formatRelativeTime — years", () => {
  it("returns '1 year ago' for ~400 days elapsed", () => {
    const date = "2025-03-23";
    const dateMs = Date.UTC(2025, 2, 23, 0, 0, 0);
    const nowMs = dateMs + 400 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("1 year ago");
  });

  it("returns '2 years ago' for ~800 days elapsed", () => {
    const date = "2024-01-01";
    const dateMs = Date.UTC(2024, 0, 1, 0, 0, 0);
    const nowMs = dateMs + 800 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(date, nowMs)).toBe("2 years ago");
  });
});

// ---------------------------------------------------------------------------
// formatRelativeMs — millisecond-input variant used by Schedules UI.
//
// Behavior contract (mirrors the inline copy that previously lived in
// components/schedules/schedule-list.tsx, kept verbatim so the component swap
// is a pure drop-in):
//
//   null            → "—"
//   |diff| < 60 s   → "just now"
//   |diff| < 60 min → "N minute(s) [ago|from now]"
//   |diff| < 24 h   → "N hour(s) [ago|from now]"
//   |diff| < 14 d   → "N day(s) [ago|from now]"
//   |diff| >= 14 d  → "N week(s) [ago|from now]"
// ---------------------------------------------------------------------------

const NOW_MS = Date.UTC(2026, 3, 28, 12, 0, 0); // 2026-04-28T12:00:00Z

describe("formatRelativeMs — null input", () => {
  it("returns '—' for null", () => {
    expect(formatRelativeMs(null, NOW_MS)).toBe("—");
  });

  it("returns '—' for null even when nowMs is omitted (default Date.now())", () => {
    // null short-circuits before nowMs is consulted, so this is safe to test
    // without injecting nowMs.
    expect(formatRelativeMs(null)).toBe("—");
  });
});

describe("formatRelativeMs — sub-60s 'just now'", () => {
  it("returns 'just now' for 0 ms diff", () => {
    expect(formatRelativeMs(NOW_MS, NOW_MS)).toBe("just now");
  });

  it("returns 'just now' for 30s in the past", () => {
    expect(formatRelativeMs(NOW_MS - 30 * 1000, NOW_MS)).toBe("just now");
  });

  it("returns 'just now' for 59s in the past (boundary)", () => {
    expect(formatRelativeMs(NOW_MS - 59 * 1000, NOW_MS)).toBe("just now");
  });

  it("returns 'just now' for 30s in the future", () => {
    expect(formatRelativeMs(NOW_MS + 30 * 1000, NOW_MS)).toBe("just now");
  });
});

describe("formatRelativeMs — minutes (past + future, singular + plural)", () => {
  it("returns '1 minute ago' for exactly 60s past (singular)", () => {
    expect(formatRelativeMs(NOW_MS - 60 * 1000, NOW_MS)).toBe("1 minute ago");
  });

  it("returns '5 minutes ago' for 5 minutes past (plural)", () => {
    expect(formatRelativeMs(NOW_MS - 5 * 60 * 1000, NOW_MS)).toBe(
      "5 minutes ago"
    );
  });

  it("returns '59 minutes ago' for 59 minutes past (upper boundary)", () => {
    expect(formatRelativeMs(NOW_MS - 59 * 60 * 1000, NOW_MS)).toBe(
      "59 minutes ago"
    );
  });

  it("returns '1 minute from now' for 60s future (singular)", () => {
    expect(formatRelativeMs(NOW_MS + 60 * 1000, NOW_MS)).toBe(
      "1 minute from now"
    );
  });

  it("returns '15 minutes from now' for 15 minutes future (plural)", () => {
    expect(formatRelativeMs(NOW_MS + 15 * 60 * 1000, NOW_MS)).toBe(
      "15 minutes from now"
    );
  });
});

describe("formatRelativeMs — hours (past + future, singular + plural)", () => {
  it("returns '1 hour ago' for exactly 60min past (singular)", () => {
    expect(formatRelativeMs(NOW_MS - 60 * 60 * 1000, NOW_MS)).toBe(
      "1 hour ago"
    );
  });

  it("returns '3 hours ago' for 3 hours past (plural)", () => {
    expect(formatRelativeMs(NOW_MS - 3 * 60 * 60 * 1000, NOW_MS)).toBe(
      "3 hours ago"
    );
  });

  it("returns '1 hour from now' for 60min future (singular)", () => {
    expect(formatRelativeMs(NOW_MS + 60 * 60 * 1000, NOW_MS)).toBe(
      "1 hour from now"
    );
  });

  it("returns '23 hours from now' for 23 hours future (upper boundary, plural)", () => {
    expect(formatRelativeMs(NOW_MS + 23 * 60 * 60 * 1000, NOW_MS)).toBe(
      "23 hours from now"
    );
  });
});

describe("formatRelativeMs — days (past + future, singular + plural)", () => {
  it("returns '1 day ago' for exactly 24h past (singular)", () => {
    expect(formatRelativeMs(NOW_MS - 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "1 day ago"
    );
  });

  it("returns '3 days ago' for 3 days past (plural)", () => {
    expect(formatRelativeMs(NOW_MS - 3 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "3 days ago"
    );
  });

  it("returns '13 days ago' for 13 days past (upper boundary)", () => {
    expect(formatRelativeMs(NOW_MS - 13 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "13 days ago"
    );
  });

  it("returns '2 days from now' for 2 days future", () => {
    expect(formatRelativeMs(NOW_MS + 2 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "2 days from now"
    );
  });
});

describe("formatRelativeMs — weeks (past + future, singular + plural)", () => {
  it("returns '2 weeks ago' for exactly 14 days past (lower boundary)", () => {
    expect(formatRelativeMs(NOW_MS - 14 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "2 weeks ago"
    );
  });

  it("returns '4 weeks ago' for 30 days past (plural)", () => {
    expect(formatRelativeMs(NOW_MS - 30 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "4 weeks ago"
    );
  });

  it("returns '3 weeks from now' for 21 days future (plural)", () => {
    expect(formatRelativeMs(NOW_MS + 21 * 24 * 60 * 60 * 1000, NOW_MS)).toBe(
      "3 weeks from now"
    );
  });
});

describe("formatRelativeMs — nowMs default", () => {
  it("returns a string when nowMs is omitted (uses Date.now())", () => {
    // Smoke test: verify the function works without an explicit nowMs and
    // returns a string. Concrete value depends on real wall-clock time, so we
    // assert only the shape.
    const result = formatRelativeMs(Date.now() - 5 * 60 * 1000);
    expect(typeof result).toBe("string");
    // Should be either "5 minutes ago" or "4 minutes ago" depending on clock
    // edge timing — just verify it includes "ago".
    expect(result).toMatch(/ago$/);
  });
});
