import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CostCard } from "./cost-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

interface FetchPlan {
  cost?: { ok: boolean; data?: { session: number; total: number }; throws?: boolean };
  history?: {
    ok: boolean;
    data?: { sessions: Array<{ file: string; cost: number; mtimeMs: number }> };
    throws?: boolean;
  };
}

function mockFetch(plan: FetchPlan) {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.includes("/cost-history")) {
      const h = plan.history;
      if (!h) return new Response("", { status: 200 });
      if (h.throws) throw new Error("network");
      if (!h.ok) return new Response("err", { status: 500 });
      return new Response(JSON.stringify({ data: h.data }), { status: 200 });
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

describe("CostCard sparkline integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("does not render sparkline when history returns 0 sessions", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      history: { ok: true, data: { sessions: [] } },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/this session/)).toBeTruthy());
    expect(document.querySelector("svg[data-testid='sparkline']")).toBeNull();
  });

  it("does not render sparkline when history returns 1 session", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      history: {
        ok: true,
        data: { sessions: [{ file: "a.jsonl", cost: 0.1, mtimeMs: 1000 }] },
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/this session/)).toBeTruthy());
    expect(document.querySelector("svg[data-testid='sparkline']")).toBeNull();
  });

  it("renders sparkline and 'Last 3 sessions' label when history has 3 sessions", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.5, total: 1.5 } },
      history: {
        ok: true,
        data: {
          sessions: [
            { file: "a.jsonl", cost: 0.3, mtimeMs: 1000 },
            { file: "b.jsonl", cost: 0.5, mtimeMs: 2000 },
            { file: "c.jsonl", cost: 0.7, mtimeMs: 3000 },
          ],
        },
      },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => {
      expect(document.querySelector("svg[data-testid='sparkline']")).not.toBeNull();
    });
    expect(screen.getByText("Last 3 sessions")).toBeTruthy();
  });

  it("does not render sparkline when history fetch fails (graceful degradation)", async () => {
    mockFetch({
      cost: { ok: true, data: { session: 0.1, total: 0.5 } },
      history: { ok: false, throws: true },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => expect(screen.getByText(/this session/)).toBeTruthy());
    expect(document.querySelector("svg[data-testid='sparkline']")).toBeNull();
    // Cost scalars still display
    expect(screen.getByText(/this session/)).toBeTruthy();
  });

  it("renders 'Last 10 sessions' when history returns full 10", async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      file: `s${i}.jsonl`,
      cost: i * 0.1,
      mtimeMs: i * 1000,
    }));
    mockFetch({
      cost: { ok: true, data: { session: 1, total: 5 } },
      history: { ok: true, data: { sessions } },
    });
    render(<CostCard projectId={1} running={true} />);
    await waitFor(() => {
      expect(document.querySelector("svg[data-testid='sparkline']")).not.toBeNull();
    });
    expect(screen.getByText("Last 10 sessions")).toBeTruthy();
  });
});
