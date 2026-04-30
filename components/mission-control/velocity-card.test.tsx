import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { VelocityCard } from "./velocity-card";
import type { VelocityResult } from "@/lib/velocity";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.useRealTimers();
});

function makeResult(overrides: Partial<VelocityResult> = {}): VelocityResult {
  return {
    weeks: Array.from({ length: 14 }, (_, i) => ({
      weekStart: `2026-0${1 + Math.floor(i / 7)}-${String((i % 7) + 1).padStart(2, "0")}`,
      count: i % 3,
      rollingAvg: i % 3,
      isCurrentWeek: i === 13,
    })),
    avgTasksPerWeek: 2.3,
    trend: "stable",
    totalCompletedWithDate: 20,
    ...overrides,
  };
}

interface FetchPlan {
  ok?: boolean;
  data?: VelocityResult;
  throws?: boolean;
}

function mockFetch(plan: FetchPlan) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("/velocity")) {
      if (plan.throws) throw new Error("network");
      if (plan.ok === false) return new Response("err", { status: 500 });
      return new Response(JSON.stringify({ data: plan.data }), { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("VelocityCard", () => {
  it("shows the loading skeleton on initial mount", () => {
    mockFetch({ ok: true, data: makeResult() });
    render(<VelocityCard projectId={1} running={true} />);
    expect(screen.getByTestId("velocity-loading")).toBeTruthy();
  });

  it("renders trend 'up' badge when trend is 'up'", async () => {
    mockFetch({ ok: true, data: makeResult({ trend: "up" }) });
    render(<VelocityCard projectId={1} running={true} />);
    const badge = await screen.findByTestId("velocity-trend-badge");
    expect(badge.getAttribute("data-trend")).toBe("up");
    expect(badge.textContent).toContain("Up");
  });

  it("renders trend 'down' badge when trend is 'down'", async () => {
    mockFetch({ ok: true, data: makeResult({ trend: "down" }) });
    render(<VelocityCard projectId={1} running={true} />);
    const badge = await screen.findByTestId("velocity-trend-badge");
    expect(badge.getAttribute("data-trend")).toBe("down");
    expect(badge.textContent).toContain("Down");
  });

  it("renders 'Stable' badge when trend is 'stable'", async () => {
    mockFetch({ ok: true, data: makeResult({ trend: "stable" }) });
    render(<VelocityCard projectId={1} running={false} />);
    const badge = await screen.findByTestId("velocity-trend-badge");
    expect(badge.getAttribute("data-trend")).toBe("stable");
    expect(badge.textContent).toContain("Stable");
  });

  it("renders avgTasksPerWeek with one decimal in the summary row", async () => {
    mockFetch({ ok: true, data: makeResult({ avgTasksPerWeek: 3.4 }) });
    render(<VelocityCard projectId={1} running={true} />);
    await waitFor(() => {
      expect(screen.getByText(/3\.4 tasks\/week/i)).toBeTruthy();
    });
  });

  it("renders the VelocityChart when data has non-zero counts", async () => {
    mockFetch({ ok: true, data: makeResult() });
    const { container } = render(<VelocityCard projectId={1} running={true} />);
    await waitFor(() => {
      const chart = container.querySelector("svg[data-testid='velocity-chart']");
      expect(chart).not.toBeNull();
    });
  });

  it("shows 'Velocity data unavailable' when the fetch returns 500", async () => {
    mockFetch({ ok: false });
    render(<VelocityCard projectId={1} running={true} />);
    await waitFor(() => {
      expect(screen.getByText(/Velocity data unavailable/i)).toBeTruthy();
    });
  });

  it("clears the polling interval on unmount", async () => {
    mockFetch({ ok: true, data: makeResult() });
    const clearSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<VelocityCard projectId={1} running={true} />);
    await waitFor(() => screen.getByTestId("velocity-trend-badge"));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("polls every 30s when running and 60s when stopped", async () => {
    mockFetch({ ok: true, data: makeResult() });
    const setSpy = vi.spyOn(global, "setInterval");

    const { unmount: u1 } = render(<VelocityCard projectId={1} running={true} />);
    await waitFor(() => screen.getByTestId("velocity-trend-badge"));
    // Filter for the card's own polling calls — waitFor itself uses
    // setInterval at ~50ms which we don't care about here.
    const runningCalls = setSpy.mock.calls.filter(
      (c) => c[1] === 30_000 || c[1] === 60_000
    );
    expect(runningCalls.length).toBeGreaterThan(0);
    expect(runningCalls.at(-1)?.[1]).toBe(30_000);
    u1();
    cleanup();

    setSpy.mockClear();
    const { unmount: u2 } = render(<VelocityCard projectId={1} running={false} />);
    await waitFor(() => screen.getByTestId("velocity-trend-badge"));
    const stoppedCalls = setSpy.mock.calls.filter(
      (c) => c[1] === 30_000 || c[1] === 60_000
    );
    expect(stoppedCalls.length).toBeGreaterThan(0);
    expect(stoppedCalls.at(-1)?.[1]).toBe(60_000);
    u2();
  });
});
