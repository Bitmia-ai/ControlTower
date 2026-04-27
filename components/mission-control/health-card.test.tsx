import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HealthCard } from "./health-card";
import type { RedEyeState } from "@/lib/redeye-types";

afterEach(() => {
  cleanup();
});

function makeState(overrides: Partial<RedEyeState["health"]> = {}): RedEyeState {
  return {
    phase: "triage",
    phase_status: "complete",
    health: {
      confidence: "HIGH",
      env_status: "healthy",
      iterations_since_last_deploy: 0,
      last_deploy_result: "success",
      last_verify_result: "pass",
      last_verify_iteration: 10,
      last_deploy_iteration: 10,
      current_iteration: 11,
      questions_awaiting_ceo: 0,
      oldest_question_hours: 0,
      blocked_items_count: 0,
      full_regression_overdue: false,
      ...overrides,
    },
  } as unknown as RedEyeState;
}

describe("HealthCard", () => {
  it("renders Healthy status for HIGH confidence + healthy env", () => {
    render(<HealthCard state={makeState()} totalShippedCount={0} />);
    expect(screen.getByText("Healthy")).toBeTruthy();
  });

  it("renders Unhealthy status for unhealthy env", () => {
    render(<HealthCard state={makeState({ env_status: "unhealthy" })} totalShippedCount={0} />);
    expect(screen.getByText("Unhealthy")).toBeTruthy();
  });

  it("renders Degraded status for MEDIUM confidence", () => {
    render(<HealthCard state={makeState({ confidence: "MEDIUM" })} totalShippedCount={0} />);
    expect(screen.getByText("Degraded")).toBeTruthy();
  });

  it("shows totalShippedCount as the shipped number", () => {
    render(<HealthCard state={makeState()} totalShippedCount={82} />);
    expect(screen.getByText("82")).toBeTruthy();
    expect(screen.getByText(/shipped/)).toBeTruthy();
  });

  it("shows 0 shipped when totalShippedCount is 0", () => {
    render(<HealthCard state={makeState()} totalShippedCount={0} />);
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows large totalShippedCount correctly (not capped at 10)", () => {
    render(<HealthCard state={makeState()} totalShippedCount={75} />);
    expect(screen.getByText("75")).toBeTruthy();
  });

  it("shows questions waiting count when > 0", () => {
    render(<HealthCard state={makeState({ questions_awaiting_ceo: 2 })} totalShippedCount={0} />);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/questions waiting/)).toBeTruthy();
  });

  it("shows 'No blockers' when no questions or blocked items", () => {
    render(<HealthCard state={makeState()} totalShippedCount={0} />);
    expect(screen.getByText("No blockers")).toBeTruthy();
  });

  it("shows blocked items count when > 0", () => {
    render(<HealthCard state={makeState({ blocked_items_count: 3 })} totalShippedCount={0} />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/blocked/)).toBeTruthy();
  });

  it("renders with null state gracefully", () => {
    render(<HealthCard state={null} totalShippedCount={0} />);
    expect(screen.getByText("No data")).toBeTruthy();
  });
});
