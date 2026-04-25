import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ScheduleList } from "./schedule-list";
import type { ScheduleEntry } from "@/lib/redeye-types";

afterEach(() => {
  cleanup();
});

const NOW_MS = Date.parse("2026-04-25T10:00:00Z");

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "SCHED-001",
    title: "Weekly check",
    frequency: "every 7d",
    lastRunIso: "2026-04-18T10:00:00Z",
    steps: ["Step one", "Step two"],
    assignedTo: "Dev",
    nextDueMs: Date.parse("2026-04-25T10:00:00Z") + 1000, // slightly in future
    isOverdue: false,
    ...overrides,
  };
}

describe("ScheduleList", () => {
  it("renders empty state gracefully when no schedules", () => {
    // ScheduleList expects non-empty array; empty renders nothing
    const { container } = render(<ScheduleList schedules={[]} />);
    // Container should be mostly empty (no rows)
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("renders a schedule row for each entry", () => {
    const entries = [
      makeEntry({ id: "SCHED-001", title: "Alpha check" }),
      makeEntry({ id: "SCHED-002", title: "Beta check" }),
    ];
    render(<ScheduleList schedules={entries} />);
    expect(screen.getByText("Alpha check")).toBeDefined();
    expect(screen.getByText("Beta check")).toBeDefined();
  });

  it("shows Overdue section heading when any entry is overdue", () => {
    const overdueEntry = makeEntry({
      id: "SCHED-001",
      title: "Overdue task",
      isOverdue: true,
      lastRunIso: "2026-04-01T00:00:00Z",
      nextDueMs: Date.parse("2026-04-08T00:00:00Z"),
    });
    render(<ScheduleList schedules={[overdueEntry]} />);
    expect(screen.getByText(/Overdue \(1\)/i)).toBeDefined();
  });

  it("shows Overdue badge on overdue entry row", () => {
    const overdueEntry = makeEntry({ isOverdue: true, nextDueMs: Date.parse("2026-04-01T00:00:00Z") });
    render(<ScheduleList schedules={[overdueEntry]} />);
    expect(screen.getByText("Overdue")).toBeDefined();
  });

  it("shows On schedule badge when entry is not overdue and not never-run", () => {
    const entry = makeEntry({
      isOverdue: false,
      lastRunIso: "2026-04-24T10:00:00Z",
      nextDueMs: Date.parse("2026-05-01T10:00:00Z"),
    });
    render(<ScheduleList schedules={[entry]} />);
    expect(screen.getByText("On schedule")).toBeDefined();
  });

  it("shows Never run badge when lastRunIso is null but nextDueMs is set", () => {
    const entry = makeEntry({
      lastRunIso: null,
      nextDueMs: 0,
      isOverdue: true,
    });
    render(<ScheduleList schedules={[entry]} />);
    // isOverdue = true and lastRunIso = null -> "Never run" badge
    expect(screen.getByText("Never run")).toBeDefined();
  });

  it("shows Unknown schedule badge when nextDueMs is null", () => {
    const entry = makeEntry({
      nextDueMs: null,
      isOverdue: false,
      lastRunIso: null,
    });
    render(<ScheduleList schedules={[entry]} />);
    expect(screen.getByText("Unknown schedule")).toBeDefined();
  });

  it("expands steps when row button is clicked", () => {
    const entry = makeEntry({ steps: ["Clean files", "Run audit"] });
    render(<ScheduleList schedules={[entry]} />);

    // Steps are hidden initially
    expect(screen.queryByText("Clean files")).toBeNull();

    // Click to expand
    const btn = screen.getByRole("button", { name: /expand schedule/i });
    fireEvent.click(btn);

    expect(screen.getByText("Clean files")).toBeDefined();
    expect(screen.getByText("Run audit")).toBeDefined();
  });

  it("collapses steps when expanded row button is clicked again", () => {
    const entry = makeEntry({ steps: ["Step A"] });
    render(<ScheduleList schedules={[entry]} />);
    const btn = screen.getByRole("button", { name: /expand schedule/i });
    fireEvent.click(btn); // expand
    expect(screen.getByText("Step A")).toBeDefined();
    fireEvent.click(btn); // collapse
    expect(screen.queryByText("Step A")).toBeNull();
  });

  it("shows entry ID badge", () => {
    const entry = makeEntry({ id: "SCHED-007" });
    render(<ScheduleList schedules={[entry]} />);
    expect(screen.getByText("SCHED-007")).toBeDefined();
  });

  it("separates overdue and on-schedule into sections", () => {
    const overdue = makeEntry({
      id: "SCHED-001",
      isOverdue: true,
      nextDueMs: Date.parse("2026-04-01T00:00:00Z"),
    });
    const onTime = makeEntry({
      id: "SCHED-002",
      isOverdue: false,
      nextDueMs: Date.parse("2026-05-01T00:00:00Z"),
    });
    render(<ScheduleList schedules={[onTime, overdue]} />);
    // Overdue section should appear
    expect(screen.getByText(/Overdue \(1\)/i)).toBeDefined();
    // On-schedule section should appear (since there is also an overdue one)
    expect(screen.getByText(/On schedule \(1\)/i)).toBeDefined();
  });
});
