import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SessionHistoryRow, formatDuration } from "./session-history-row";
import type { SessionHistoryEntry } from "@/lib/cost-history";

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

describe("SessionHistoryRow", () => {
  it("renders cost as $1.42 for cost: 1.42", () => {
    render(<SessionHistoryRow entry={makeEntry({ cost: 1.42 })} />);
    expect(screen.getByText("$1.42")).toBeTruthy();
  });

  it("renders 4-decimal cost when below $0.01", () => {
    render(<SessionHistoryRow entry={makeEntry({ cost: 0.0042 })} />);
    expect(screen.getByText("$0.0042")).toBeTruthy();
  });

  it("renders one PhaseChip per phase", () => {
    render(<SessionHistoryRow entry={makeEntry({ phases: ["PLAN", "BUILD", "REVIEW"] })} />);
    expect(screen.getByText("PLN")).toBeTruthy();
    expect(screen.getByText("BLD")).toBeTruthy();
    expect(screen.getByText("REV")).toBeTruthy();
  });

  it("truncates phases beyond 8 with +N more label", () => {
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
    expect(screen.getByText("+2 more")).toBeTruthy();
  });

  it("shows em-dash indicator when phases is empty", () => {
    render(<SessionHistoryRow entry={makeEntry({ phases: [] })} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("aria-label on chip strip lists phase names", () => {
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

  it("expands to show file path when button clicked", () => {
    const entry = makeEntry({ file: "my-session.jsonl" });
    render(<SessionHistoryRow entry={entry} />);
    const btn = screen.getByRole("button");
    expect(screen.queryByText("my-session.jsonl")).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText("my-session.jsonl")).toBeTruthy();
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
});
