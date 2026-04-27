import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ScheduleList } from "./schedule-list";
import type { ScheduleEntry } from "@/lib/redeye-types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PROJECT_ID = "1";

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "SCHED-001",
    title: "Weekly check",
    frequency: "every 7d",
    lastRunIso: "2026-04-18T10:00:00Z",
    steps: ["Step one", "Step two"],
    assignedTo: "Dev",
    nextDueMs: Date.parse("2026-04-25T10:00:00Z") + 1000,
    isOverdue: false,
    ...overrides,
  };
}

describe("ScheduleList", () => {
  it("renders empty state gracefully when no schedules", () => {
    const { container } = render(<ScheduleList schedules={[]} projectId={PROJECT_ID} />);
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("renders a schedule row for each entry", () => {
    const entries = [
      makeEntry({ id: "SCHED-001", title: "Alpha check" }),
      makeEntry({ id: "SCHED-002", title: "Beta check" }),
    ];
    render(<ScheduleList schedules={entries} projectId={PROJECT_ID} />);
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
    render(<ScheduleList schedules={[overdueEntry]} projectId={PROJECT_ID} />);
    expect(screen.getByText(/Overdue \(1\)/i)).toBeDefined();
  });

  it("shows Overdue badge on overdue entry row", () => {
    const overdueEntry = makeEntry({ isOverdue: true, nextDueMs: Date.parse("2026-04-01T00:00:00Z") });
    render(<ScheduleList schedules={[overdueEntry]} projectId={PROJECT_ID} />);
    expect(screen.getByText("Overdue")).toBeDefined();
  });

  it("shows On schedule badge when entry is not overdue and not never-run", () => {
    const entry = makeEntry({
      isOverdue: false,
      lastRunIso: "2026-04-24T10:00:00Z",
      nextDueMs: Date.parse("2026-05-01T10:00:00Z"),
    });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
    expect(screen.getByText("On schedule")).toBeDefined();
  });

  it("shows Never run badge when lastRunIso is null but nextDueMs is set", () => {
    const entry = makeEntry({
      lastRunIso: null,
      nextDueMs: 0,
      isOverdue: true,
    });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
    expect(screen.getByText("Never run")).toBeDefined();
  });

  it("shows Unknown schedule badge when nextDueMs is null", () => {
    const entry = makeEntry({
      nextDueMs: null,
      isOverdue: false,
      lastRunIso: null,
    });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
    expect(screen.getByText("Unknown schedule")).toBeDefined();
  });

  it("expands steps when row button is clicked", () => {
    const entry = makeEntry({ steps: ["Clean files", "Run audit"] });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);

    expect(screen.queryByText("Clean files")).toBeNull();

    const btn = screen.getByRole("button", { name: /expand schedule/i });
    fireEvent.click(btn);

    expect(screen.getByText("Clean files")).toBeDefined();
    expect(screen.getByText("Run audit")).toBeDefined();
  });

  it("collapses steps when expanded row button is clicked again", () => {
    const entry = makeEntry({ steps: ["Step A"] });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
    const btn = screen.getByRole("button", { name: /expand schedule/i });
    fireEvent.click(btn);
    expect(screen.getByText("Step A")).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByText("Step A")).toBeNull();
  });

  it("shows entry ID badge", () => {
    const entry = makeEntry({ id: "SCHED-007" });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
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
    render(<ScheduleList schedules={[onTime, overdue]} projectId={PROJECT_ID} />);
    expect(screen.getByText(/Overdue \(1\)/i)).toBeDefined();
    expect(screen.getByText(/On schedule \(1\)/i)).toBeDefined();
  });

  it("renders Run now button for each schedule row", () => {
    const entries = [
      makeEntry({ id: "SCHED-001" }),
      makeEntry({ id: "SCHED-002" }),
    ];
    render(<ScheduleList schedules={entries} projectId={PROJECT_ID} />);
    const buttons = screen.getAllByRole("button", { name: /run schedule/i });
    expect(buttons.length).toBe(2);
  });

  it("Run now button POSTs to the correct endpoint on click", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { queued: true } }) });
    vi.stubGlobal("fetch", fetchMock);

    const entry = makeEntry({ id: "SCHED-001" });
    render(<ScheduleList schedules={[entry]} projectId="42" />);

    const runBtn = screen.getByRole("button", { name: /run schedule SCHED-001/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects/42/schedules/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ scheduleId: "SCHED-001" }),
        })
      );
    });
  });

  it("shows Queued feedback after successful run", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { queued: true } }) });
    vi.stubGlobal("fetch", fetchMock);

    const entry = makeEntry({ id: "SCHED-001" });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);

    const runBtn = screen.getByRole("button", { name: /run schedule SCHED-001/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Queued/i)).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Delete functionality tests
// ---------------------------------------------------------------------------

describe("ScheduleList — delete", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a delete button with correct aria-label when onDelete is provided", () => {
    const entry = makeEntry({ id: "SCHED-001" });
    render(
      <ScheduleList schedules={[entry]} projectId={PROJECT_ID} onDelete={vi.fn()} />
    );
    const deleteBtn = screen.getByRole("button", { name: /delete schedule SCHED-001/i });
    expect(deleteBtn).toBeDefined();
  });

  it("does not render a delete button when onDelete is not provided", () => {
    const entry = makeEntry({ id: "SCHED-001" });
    render(<ScheduleList schedules={[entry]} projectId={PROJECT_ID} />);
    const deleteBtn = screen.queryByRole("button", { name: /delete schedule SCHED-001/i });
    expect(deleteBtn).toBeNull();
  });

  it("shows inline confirmation panel on trash icon click", () => {
    const entry = makeEntry({ id: "SCHED-001" });
    render(
      <ScheduleList schedules={[entry]} projectId={PROJECT_ID} onDelete={vi.fn()} />
    );
    const deleteBtn = screen.getByRole("button", { name: /delete schedule SCHED-001/i });
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/delete this schedule\?/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel delete/i })).toBeDefined();
  });

  it("hides confirmation panel on Cancel click", () => {
    const entry = makeEntry({ id: "SCHED-001" });
    render(
      <ScheduleList schedules={[entry]} projectId={PROJECT_ID} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete schedule SCHED-001/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel delete/i }));
    expect(screen.queryByText(/delete this schedule\?/i)).toBeNull();
  });

  it("calls onDelete with the schedule id after successful API delete", async () => {
    const onDelete = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const entry = makeEntry({ id: "SCHED-001" });
    render(
      <ScheduleList schedules={[entry]} projectId={PROJECT_ID} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete schedule SCHED-001/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("SCHED-001");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/schedules\/SCHED-001$/),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("shows error message when API delete fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const entry = makeEntry({ id: "SCHED-001" });
    render(
      <ScheduleList schedules={[entry]} projectId={PROJECT_ID} onDelete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete schedule SCHED-001/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeDefined();
    });
  });
});
