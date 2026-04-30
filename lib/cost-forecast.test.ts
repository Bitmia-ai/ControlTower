import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cost-history", () => ({
  getSessionCostHistory: vi.fn(),
}));

import { computeCostForecast } from "./cost-forecast";
import { getSessionCostHistory } from "@/lib/cost-history";

const mockHistory = getSessionCostHistory as ReturnType<typeof vi.fn>;

const ONE_DAY = 86_400_000;

function makeSessions(costs: number[], startMtime = 1_000_000_000_000): {
  file: string;
  cost: number;
  mtimeMs: number;
}[] {
  return costs.map((cost, i) => ({
    file: `s${i}.jsonl`,
    cost,
    mtimeMs: startMtime + i * ONE_DAY,
  }));
}

describe("computeCostForecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all-zero shape when there are no sessions", async () => {
    mockHistory.mockResolvedValue([]);
    const result = await computeCostForecast("/p");
    expect(result.sessions).toEqual([]);
    expect(result.burnRatePerSession).toBe(0);
    expect(result.trend).toBe("stable");
    expect(result.forecast24h).toBe(0);
    expect(result.forecast7d).toBe(0);
    expect(result.sessionsPerDay).toBe(0);
    expect(result.projectedSessions).toEqual([]);
  });

  it("uses single session cost as burn rate when only one session exists", async () => {
    mockHistory.mockResolvedValue(makeSessions([1.5]));
    const result = await computeCostForecast("/p");
    expect(result.burnRatePerSession).toBe(1.5);
    expect(result.sessions).toHaveLength(1);
    // Only 1 session: projection still has 5 points (extrapolation possible)
    expect(result.projectedSessions).toHaveLength(5);
    // Default sessionsPerDay = 3 (per AD-6 fewer than 2 sessions)
    expect(result.sessionsPerDay).toBe(3);
  });

  it("computes stable trend for 7 equal sessions of $1.00 each", async () => {
    mockHistory.mockResolvedValue(makeSessions([1, 1, 1, 1, 1, 1, 1]));
    const result = await computeCostForecast("/p");
    expect(result.burnRatePerSession).toBeCloseTo(1.0, 5);
    expect(result.trend).toBe("stable");
    expect(result.projectedSessions).toHaveLength(5);
    // Each projected point should equal burn rate ($1)
    for (const p of result.projectedSessions) {
      expect(p.cost).toBeCloseTo(1, 5);
    }
  });

  it("detects accelerating trend when last 3 sessions are 2x prior 4 sessions", async () => {
    mockHistory.mockResolvedValue(makeSessions([0.5, 0.5, 0.5, 0.5, 2.0, 2.0, 2.0]));
    const result = await computeCostForecast("/p");
    expect(result.trend).toBe("accelerating");
  });

  it("detects decelerating trend when last 3 sessions are half of prior 4 sessions", async () => {
    mockHistory.mockResolvedValue(makeSessions([2.0, 2.0, 2.0, 2.0, 0.5, 0.5, 0.5]));
    const result = await computeCostForecast("/p");
    expect(result.trend).toBe("decelerating");
  });

  it("clamps sessionsPerDay to a minimum of 0.5 when sessions span very long times", async () => {
    // 2 sessions, 10 days apart → would give 0.2/day; clamp to 0.5
    const t0 = 1_000_000_000_000;
    mockHistory.mockResolvedValue([
      { file: "a.jsonl", cost: 1, mtimeMs: t0 },
      { file: "b.jsonl", cost: 1, mtimeMs: t0 + 10 * ONE_DAY },
    ]);
    const result = await computeCostForecast("/p");
    expect(result.sessionsPerDay).toBeGreaterThanOrEqual(0.5);
    expect(result.sessionsPerDay).toBeLessThanOrEqual(0.5 + 0.001);
  });

  it("clamps sessionsPerDay to a maximum of 24 when sessions are tightly packed", async () => {
    // 7 sessions all in 1 minute → enormous rate; clamp to 24
    const t0 = 1_000_000_000_000;
    mockHistory.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
        file: `s${i}.jsonl`,
        cost: 1,
        mtimeMs: t0 + i * 1000,
      }))
    );
    const result = await computeCostForecast("/p");
    expect(result.sessionsPerDay).toBeLessThanOrEqual(24);
    expect(result.sessionsPerDay).toBe(24);
  });

  it("returns exactly 5 projected points starting after the last real session index", async () => {
    mockHistory.mockResolvedValue(makeSessions([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]));
    const result = await computeCostForecast("/p");
    expect(result.projectedSessions).toHaveLength(5);
    // Indexes start at sessions.length (10) for first projected point
    expect(result.projectedSessions[0].sessionIndex).toBe(10);
    expect(result.projectedSessions[4].sessionIndex).toBe(14);
  });

  it("computes forecast24h and forecast7d as burnRate × sessionsPerDay × N", async () => {
    // 4 sessions over 3 days → ~1.33 sessions/day
    const t0 = 1_000_000_000_000;
    mockHistory.mockResolvedValue([
      { file: "a.jsonl", cost: 2, mtimeMs: t0 },
      { file: "b.jsonl", cost: 2, mtimeMs: t0 + ONE_DAY },
      { file: "c.jsonl", cost: 2, mtimeMs: t0 + 2 * ONE_DAY },
      { file: "d.jsonl", cost: 2, mtimeMs: t0 + 3 * ONE_DAY },
    ]);
    const result = await computeCostForecast("/p");
    expect(result.burnRatePerSession).toBeCloseTo(2.0, 5);
    expect(result.forecast24h).toBeCloseTo(
      result.burnRatePerSession * result.sessionsPerDay,
      5
    );
    expect(result.forecast7d).toBeCloseTo(
      result.burnRatePerSession * result.sessionsPerDay * 7,
      5
    );
  });

  it("returns safe zeros when getSessionCostHistory throws", async () => {
    mockHistory.mockRejectedValue(new Error("bad disk"));
    const result = await computeCostForecast("/p");
    expect(result.sessions).toEqual([]);
    expect(result.burnRatePerSession).toBe(0);
    expect(result.trend).toBe("stable");
    expect(result.forecast24h).toBe(0);
    expect(result.forecast7d).toBe(0);
    expect(result.projectedSessions).toEqual([]);
  });

  it("uses min(7, length) for rolling average when fewer than 7 sessions exist", async () => {
    // 3 sessions: avg = (1 + 2 + 3) / 3 = 2
    mockHistory.mockResolvedValue(makeSessions([1, 2, 3]));
    const result = await computeCostForecast("/p");
    expect(result.burnRatePerSession).toBeCloseTo(2.0, 5);
  });

  it("forwards sessionLimit parameter to getSessionCostHistory", async () => {
    mockHistory.mockResolvedValue([]);
    await computeCostForecast("/p", 25);
    expect(mockHistory).toHaveBeenCalledWith("/p", 25);
  });
});
