import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import {
  SessionHistoryRow,
  formatDuration,
  toTitleCase,
  extractTaskLine,
} from "./session-history-row";
import type {
  IterationSummary,
  SessionHistoryEntry,
} from "@/lib/cost-history";

afterEach(() => {
  cleanup();
});

function makeEntry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return {
    file: "abc.jsonl",
    cost: 1.42,
    mtimeMs: Date.parse("2026-04-25T15:42:00Z"),
    startedAt: Date.parse("2026-04-25T14:00:00Z"),
    durationMs: 102 * 60 * 1000,
    phases: ["TRIAGE", "PLAN", "BUILD"],
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("returns < 1 min for very small durations", () => {
    expect(formatDuration(0)).toBe("< 1 min");
    expect(formatDuration(30_000)).toBe("< 1 min");
  });

  it("returns minutes only when under 1h", () => {
    expect(formatDuration(60_000)).toBe("1 min");
    expect(formatDuration(42 * 60_000)).toBe("42 min");
  });

  it("returns hours and minutes when over 1h", () => {
    expect(formatDuration(60 * 60_000)).toBe("1h 0m");
    expect(formatDuration(83 * 60_000)).toBe("1h 23m");
    expect(formatDuration(125 * 60_000)).toBe("2h 5m");
  });
});

describe("toTitleCase", () => {
  it("converts upper-case phase tokens to title case", () => {
    expect(toTitleCase("TRIAGE")).toBe("Triage");
    expect(toTitleCase("BUILD")).toBe("Build");
    expect(toTitleCase("DEPLOY")).toBe("Deploy");
  });

  it("handles already title-cased input", () => {
    expect(toTitleCase("Plan")).toBe("Plan");
  });

  it("handles empty string without crashing", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("handles mixed-case input", () => {
    expect(toTitleCase("rEvIeW")).toBe("Review");
  });
});

describe("SessionHistoryRow", () => {
  it("renders cost as $1.42 for cost: 1.42", () => {
    render(<SessionHistoryRow entry={makeEntry({ cost: 1.42 })} />);
    expect(screen.getByText("$1.42")).toBeTruthy();
  });

  it("renders 4-decimal cost when below $0.01", () => {
    render(<SessionHistoryRow entry={makeEntry({ cost: 0.0042 })} />);
    expect(screen.getByText("$0.0042")).toBeTruthy();
  });

  it("renders the phase flow as plain English with → separators", () => {
    render(
      <SessionHistoryRow
        entry={makeEntry({ phases: ["TRIAGE", "PLAN", "BUILD"] })}
      />,
    );
    expect(screen.getByText("Triage → Plan → Build")).toBeTruthy();
  });

  it("renders the phase flow for a single phase without separators", () => {
    render(<SessionHistoryRow entry={makeEntry({ phases: ["PLAN"] })} />);
    expect(screen.getByText("Plan")).toBeTruthy();
  });

  it("does NOT render PhaseChip abbreviations on the collapsed row", () => {
    render(
      <SessionHistoryRow
        entry={makeEntry({ phases: ["PLAN", "BUILD", "REVIEW"] })}
      />,
    );
    expect(screen.queryByText("PLN")).toBeNull();
    expect(screen.queryByText("BLD")).toBeNull();
    expect(screen.queryByText("REV")).toBeNull();
  });

  it("does NOT show the +N more truncation indicator (text flow handles long chains)", () => {
    const phases = [
      "TRIAGE",
      "PLAN",
      "BUILD",
      "REVIEW",
      "DEPLOY",
      "VERIFY",
      "MERGE",
      "HARDEN",
      "STABILIZE",
      "INCORPORATE",
    ];
    render(<SessionHistoryRow entry={makeEntry({ phases })} />);
    expect(screen.queryByText(/\+\d+ more/)).toBeNull();
    // Long phase chain renders fully as text and is CSS-truncated.
    expect(
      screen.getByText(
        "Triage → Plan → Build → Review → Deploy → Verify → Merge → Harden → Stabilize → Incorporate",
      ),
    ).toBeTruthy();
  });

  it("shows em-dash indicator when phases is empty", () => {
    render(<SessionHistoryRow entry={makeEntry({ phases: [] })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("aria-label on phase strip lists raw phase names", () => {
    render(<SessionHistoryRow entry={makeEntry({ phases: ["PLAN", "BUILD"] })} />);
    const strip = screen.getByLabelText(/Phases:.*PLAN.*BUILD/);
    expect(strip).toBeTruthy();
  });

  it("renders formatted duration", () => {
    render(<SessionHistoryRow entry={makeEntry({ durationMs: 90 * 60_000 })} />);
    expect(screen.getByText("1h 30m")).toBeTruthy();
  });

  it("renders an expand/collapse button with aria-expanded=false by default", () => {
    render(<SessionHistoryRow entry={makeEntry()} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("hides the UUID filename on the collapsed row", () => {
    const entry = makeEntry({ file: "33c3ddd2-3554-407a-b01a-d4af71b9e8c0.jsonl" });
    render(<SessionHistoryRow entry={entry} />);
    expect(
      screen.queryByText("33c3ddd2-3554-407a-b01a-d4af71b9e8c0.jsonl"),
    ).toBeNull();
  });

  it("shows the UUID filename inside the Debug footnote when expanded", () => {
    const entry = makeEntry({ file: "my-session.jsonl" });
    render(<SessionHistoryRow entry={entry} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.getByText("my-session.jsonl")).toBeTruthy();
    expect(screen.getByText("Debug: session file")).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses again when button clicked a second time", () => {
    const entry = makeEntry({ file: "session.jsonl" });
    render(<SessionHistoryRow entry={entry} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(screen.getByText("session.jsonl")).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText("session.jsonl")).toBeNull();
  });

  it("shows Started label in expanded section", () => {
    const entry = makeEntry();
    render(<SessionHistoryRow entry={entry} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Started:")).toBeTruthy();
  });

  it("shows the full PhaseChip strip in the expanded panel", () => {
    const phases = ["TRIAGE", "PLAN", "BUILD"];
    render(<SessionHistoryRow entry={makeEntry({ phases })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/All phases \(3\)/)).toBeTruthy();
    // PhaseChip renders the abbreviated codes only inside the expanded panel.
    expect(screen.getByText("TRI")).toBeTruthy();
    expect(screen.getByText("PLN")).toBeTruthy();
    expect(screen.getByText("BLD")).toBeTruthy();
  });

  it("shows Ended label when durationMs > 0", () => {
    const entry = makeEntry({ durationMs: 60_000 });
    render(<SessionHistoryRow entry={entry} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Ended:")).toBeTruthy();
  });

  it("does not show Ended label when durationMs is 0", () => {
    const entry = makeEntry({ durationMs: 0 });
    render(<SessionHistoryRow entry={entry} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Ended:")).toBeNull();
  });

  it("renders the Session #N badge when sessionNumber prop is provided", () => {
    render(<SessionHistoryRow entry={makeEntry()} sessionNumber={3} />);
    expect(screen.getByText("Session #3")).toBeTruthy();
  });

  it("omits the Session badge when sessionNumber prop is missing", () => {
    render(<SessionHistoryRow entry={makeEntry()} />);
    expect(screen.queryByText(/Session #/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T128 — extractTaskLine helper
// ---------------------------------------------------------------------------

describe("extractTaskLine", () => {
  it("returns null for undefined", () => {
    expect(extractTaskLine(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(extractTaskLine(null)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(extractTaskLine([])).toBeNull();
  });

  it("formats first task-ID match as 'T126 · short outcome'", () => {
    const summaries: IterationSummary[] = [
      { iteration: 5, outcome: "T126 complete. RunButton wired.", phases: ["BUILD"] },
    ];
    const result = extractTaskLine(summaries);
    expect(result).toMatch(/^T126 · /);
    expect(result).toContain("RunButton");
  });

  it("truncates outcomes longer than 60 chars with an ellipsis", () => {
    const long =
      "T999 super extremely very excessively long outcome description that definitely exceeds the truncation limit set by the helper";
    const summaries: IterationSummary[] = [
      { iteration: 1, outcome: long, phases: ["BUILD"] },
    ];
    const result = extractTaskLine(summaries);
    expect(result).toMatch(/…$/);
    // Prefix "T999 · " plus 60-char body plus ellipsis — bounded length.
    expect((result ?? "").length).toBeLessThanOrEqual(72);
  });

  it("falls back to the first outcome when no task ID is present", () => {
    const summaries: IterationSummary[] = [
      { iteration: 5, outcome: "Refactored phase machine routing.", phases: ["BUILD"] },
    ];
    expect(extractTaskLine(summaries)).toBe("Refactored phase machine routing.");
  });

  it("prefers an entry that mentions a task ID over one that does not", () => {
    const summaries: IterationSummary[] = [
      { iteration: 1, outcome: "Housekeeping commit.", phases: ["TRIAGE"] },
      { iteration: 2, outcome: "T200 something shipped", phases: ["BUILD"] },
    ];
    const result = extractTaskLine(summaries);
    expect(result).toMatch(/^T200 · /);
  });

  it("handles outcomes with leading 'T128:' style prefixes cleanly", () => {
    const summaries: IterationSummary[] = [
      { iteration: 99, outcome: "T128 complete. Activity panel added.", phases: ["BUILD"] },
    ];
    const result = extractTaskLine(summaries);
    // Should not contain the redundant "T128 complete." since that gets stripped
    expect(result).toBe("T128 · Activity panel added.");
  });
});

// ---------------------------------------------------------------------------
// T128 — collapsed-row task line + expanded Activity panel
// ---------------------------------------------------------------------------

describe("SessionHistoryRow with iterationSummaries (T128)", () => {
  const sampleSummaries: IterationSummary[] = [
    { iteration: 158, outcome: "T126 complete. RunButton localStorage persist.", phases: ["BUILD"] },
  ];

  it("renders the task line on the collapsed row when summaries exist", () => {
    render(
      <SessionHistoryRow entry={makeEntry({ iterationSummaries: sampleSummaries })} />
    );
    const taskLine = screen.getByTestId("session-task-line");
    expect(taskLine.textContent).toMatch(/^T126 · /);
  });

  it("does NOT render the task line when iterationSummaries is empty", () => {
    render(<SessionHistoryRow entry={makeEntry({ iterationSummaries: [] })} />);
    expect(screen.queryByTestId("session-task-line")).toBeNull();
  });

  it("does NOT render the task line when iterationSummaries is undefined", () => {
    const { iterationSummaries: _omitted, ...rest } = makeEntry();
    void _omitted;
    render(<SessionHistoryRow entry={rest as SessionHistoryEntry} />);
    expect(screen.queryByTestId("session-task-line")).toBeNull();
  });

  it("hides the Activity section while collapsed", () => {
    render(
      <SessionHistoryRow entry={makeEntry({ iterationSummaries: sampleSummaries })} />
    );
    expect(screen.queryByTestId("session-activity")).toBeNull();
  });

  it("renders 'Activity (1 iteration)' header for one summary when expanded", () => {
    render(
      <SessionHistoryRow entry={makeEntry({ iterationSummaries: sampleSummaries })} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Activity \(1 iteration\)/)).toBeTruthy();
  });

  it("renders 'Activity (3 iterations)' header for three summaries when expanded", () => {
    const three: IterationSummary[] = [
      { iteration: 1, outcome: "a", phases: ["BUILD"] },
      { iteration: 2, outcome: "b", phases: ["BUILD"] },
      { iteration: 3, outcome: "c", phases: ["BUILD"] },
    ];
    render(<SessionHistoryRow entry={makeEntry({ iterationSummaries: three })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Activity \(3 iterations\)/)).toBeTruthy();
  });

  it("renders the full outcome text from each summary in the Activity section", () => {
    render(
      <SessionHistoryRow entry={makeEntry({ iterationSummaries: sampleSummaries })} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByText("T126 complete. RunButton localStorage persist.")
    ).toBeTruthy();
  });

  it("renders the iteration number and phase flow per summary", () => {
    const two: IterationSummary[] = [
      { iteration: 158, outcome: "shipped", phases: ["DEPLOY", "VERIFY", "MERGE"] },
    ];
    render(<SessionHistoryRow entry={makeEntry({ iterationSummaries: two })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Iteration 158/)).toBeTruthy();
    expect(screen.getByText(/Deploy → Verify → Merge/)).toBeTruthy();
  });

  it("does NOT render the Activity section when iterationSummaries is empty", () => {
    render(<SessionHistoryRow entry={makeEntry({ iterationSummaries: [] })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByTestId("session-activity")).toBeNull();
  });

  it("does NOT render the Activity section when iterationSummaries is undefined", () => {
    render(<SessionHistoryRow entry={makeEntry()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByTestId("session-activity")).toBeNull();
  });
});
