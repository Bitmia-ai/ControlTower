import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { SchedulesContent } from "./page";
import type { ScheduleEntry } from "@/lib/redeye-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/project/0/schedules",
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSchedule(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "SCHED-001",
    title: "Test schedule",
    frequency: "every 7d",
    lastRunIso: "2026-04-18T10:00:00Z",
    steps: ["Do thing"],
    assignedTo: "Dev",
    nextDueMs: Date.now() + 86400 * 1000,
    isOverdue: false,
    ...overrides,
  };
}

describe("SchedulesContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {})); // never resolves
    render(<SchedulesContent id="0" />);
    // aria-busy should be present on skeleton
    const skeleton = document.querySelector("[aria-busy='true']");
    expect(skeleton).not.toBeNull();
  });

  it("shows EmptyState when API returns 0 schedules", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { schedules: [] } }),
    } as Response);

    render(<SchedulesContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No schedules defined")).toBeDefined();
    });
  });

  it("shows ScheduleList when API returns schedules", async () => {
    const schedules = [
      makeSchedule({ id: "SCHED-001", title: "Alpha check" }),
      makeSchedule({ id: "SCHED-002", title: "Beta check" }),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { schedules } }),
    } as Response);

    render(<SchedulesContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("Alpha check")).toBeDefined();
      expect(screen.getByText("Beta check")).toBeDefined();
    });
  });

  it("shows FetchError on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));
    render(<SchedulesContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load schedules/i)).toBeDefined();
    });
  });

  it("shows FetchError when API returns non-ok status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "not found" }),
    } as Response);
    render(<SchedulesContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load schedules/i)).toBeDefined();
    });
  });

  it("renders page heading immediately", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {})); // never resolves
    render(<SchedulesContent id="0" />);
    // Heading is always rendered regardless of loading state
    expect(screen.getByRole("heading", { name: "Schedules", level: 1 })).toBeDefined();
  });
});
