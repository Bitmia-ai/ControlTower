import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CostCard } from "./cost-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface ForecastShape {
  sessions: Array<{ file: string; cost: number; mtimeMs: number }>;
  burnRatePerSession: number;
  trend: "accelerating" | "decelerating" | "stable";
  forecast24h: number;
  forecast7d: number;
  sessionsPerDay: number;
  projectedSessions: Array<{ sessionIndex: number; cost: number }>;
}

interface FetchPlan {
  cost?: { ok: boolean; data?: { session: number; total: number }; throws?: boolean };
  forecast?: { ok: boolean; data?: ForecastShape; throws?: boolean };
}

function mockFetch(plan: FetchPlan) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("/cost-forecast")) {
      const f = plan.forecast;
      if (!f) return new Response("", { status: 404 });
      if (f.throws) throw new Error("network");
      if (!f.ok) return new Response("err", { status: 500 });
      return new Response(JSON.stringify({ data: f.data }), { status: 200 });
    }
    if (u.endsWith("/cost")) {
      const c = plan.cost;
      if (!c) return new Response(JSON.stringify({ data: { session: 0, total: 0 } }), { status: 200 });
      if (c.throws) throw new Error("network");
      if (!c.ok) return new Response("err", { status: 500 });
      return new Response(JSON.stringify({ data: c.data }), { status: 200 });
    }
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
}

const projection5 = Array.from({ length: 5 }, (_, i) => ({
  sessionIndex: 3 + i,
  cost: 1.0,
}));

function makeForecast(overrides: Partial<ForecastShape> = {}): ForecastShape {
  return {
    sessions: [
      { file: "a.jsonl", cost: 1.0, mtimeMs: 1_000_000 },
      { file: "b.jsonl", cost: 1.0, mtimeMs: 2_000_000 },
      { file: "c.jsonl", cost: 1.0, mtimeMs: 3_000_000 },
    ],
    burnRatePerSession: 1.0,
    trend: "stable",
    forecast24h: 3.0,
    forecast7d: 21.0,
    sessionsPerDay: 3,
    projectedSessions: projection5,
    ...overrides,
  };
}

describe("CostCard — base rendering", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("does not render the trend chart when forecast returns 0 sessions", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      forecast: {
        ok: true,
        data: makeForecast({ sessions: [], burnRatePerSession: 0, sessionsPerDay: 0 }),
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/^Session$/)).toBeTruthy());
    expect(document.querySelector("svg[data-testid='cost-trend-chart']")).toBeNull();
  });

  it("does not render the trend chart when forecast returns 1 session", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      forecast: {
        ok: true,
        data: makeForecast({
          sessions: [{ file: "a.jsonl", cost: 0.1, mtimeMs: 1000 }],
        }),
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/^Session$/)).toBeTruthy());
    expect(document.querySelector("svg[data-testid='cost-trend-chart']")).toBeNull();
  });

  it("renders the trend chart and 'Last 3 sessions + 5 projected' label", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.5, total: 1.5 } },
      forecast: { ok: true, data: makeForecast() },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => {
      expect(document.querySelector("svg[data-testid='cost-trend-chart']")).not.toBeNull();
    });
    expect(screen.getByText("Last 3 sessions + 5 projected")).toBeTruthy();
  });
});

describe("CostCard — burn rate and forecast rows", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders the Burn Rate row with the formatted dollar value per session", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 1.0, total: 5.0 } },
      forecast: { ok: true, data: makeForecast({ burnRatePerSession: 1.42 }) },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByTestId("burn-rate-row")).toBeTruthy());
    expect(screen.getByText("Burn Rate")).toBeTruthy();
    expect(screen.getByText("$1.42/session")).toBeTruthy();
  });

  it("uses amber text class when trend is accelerating", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 1.0, total: 5.0 } },
      forecast: { ok: true, data: makeForecast({ trend: "accelerating" }) },
    });
    render(<CostCard projectId={1} running={true} />);
    const row = await waitFor(() => screen.getByTestId("burn-rate-row"));
    const value = row.querySelector("span:last-child");
    expect(value?.className ?? "").toContain("text-amber-500");
    expect(screen.getByTestId("trend-icon-up")).toBeTruthy();
  });

  it("uses green text class when trend is decelerating", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 1.0, total: 5.0 } },
      forecast: { ok: true, data: makeForecast({ trend: "decelerating" }) },
    });
    render(<CostCard projectId={1} running={true} />);
    const row = await waitFor(() => screen.getByTestId("burn-rate-row"));
    const value = row.querySelector("span:last-child");
    expect(value?.className ?? "").toContain("text-green-500");
    expect(screen.getByTestId("trend-icon-down")).toBeTruthy();
  });

  it("uses default color and Minus icon when trend is stable", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 1.0, total: 5.0 } },
      forecast: { ok: true, data: makeForecast({ trend: "stable" }) },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => screen.getByTestId("burn-rate-row"));
    expect(screen.getByTestId("trend-icon-stable")).toBeTruthy();
  });

  it("renders Est. 24h and Est. 7d rows with formatted values", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 1.0, total: 5.0 } },
      forecast: {
        ok: true,
        data: makeForecast({ forecast24h: 4.5, forecast7d: 31.5 }),
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText("Est. 24h")).toBeTruthy());
    expect(screen.getByText("$4.50")).toBeTruthy();
    expect(screen.getByText("Est. 7d")).toBeTruthy();
    expect(screen.getByText("$31.50")).toBeTruthy();
  });

  it("hides Burn Rate and Est. rows when burn rate is 0", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0, total: 0 } },
      forecast: {
        ok: true,
        data: makeForecast({
          burnRatePerSession: 0,
          forecast24h: 0,
          forecast7d: 0,
          sessionsPerDay: 0,
        }),
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/^Session$/)).toBeTruthy());
    expect(screen.queryByTestId("burn-rate-row")).toBeNull();
    expect(screen.queryByText("Est. 24h")).toBeNull();
    expect(screen.queryByText("Est. 7d")).toBeNull();
  });
});

describe("CostCard — graceful degradation", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("still renders Session/Total when forecast fetch fails", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      forecast: { ok: false, throws: true },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/^Session$/)).toBeTruthy());
    expect(screen.getByText(/^Total$/)).toBeTruthy();
    expect(document.querySelector("svg[data-testid='cost-trend-chart']")).toBeNull();
    expect(screen.queryByTestId("burn-rate-row")).toBeNull();
  });

  it("calls both /cost and /cost-forecast in parallel", async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/cost-forecast")) {
        return new Response(JSON.stringify({ data: makeForecast() }), { status: 200 });
      }
      if (u.endsWith("/cost")) {
        return new Response(JSON.stringify({ data: { session: 1, total: 5 } }), { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<CostCard projectId={42} running={true} />);
    await waitFor(() => expect(screen.getByText(/^Session$/)).toBeTruthy());
    const calls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith("/api/projects/42/cost"))).toBe(true);
    expect(calls.some((u) => u.endsWith("/api/projects/42/cost-forecast"))).toBe(true);
  });
});
