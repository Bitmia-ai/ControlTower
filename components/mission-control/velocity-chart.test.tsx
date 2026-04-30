import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { VelocityChart } from "./velocity-chart";
import type { VelocityWeek } from "@/lib/velocity";

afterEach(() => {
  cleanup();
});

function makeWeeks(
  pattern: Array<{ count: number; rollingAvg?: number; isCurrent?: boolean }>
): VelocityWeek[] {
  // Generate consecutive Sunday dates (ISO YYYY-MM-DD) starting from a fixed point.
  const start = new Date("2026-01-04T12:00:00Z"); // Sunday
  return pattern.map((p, i) => {
    const d = new Date(start.getTime() + i * 7 * 86_400_000);
    return {
      weekStart: d.toISOString().slice(0, 10),
      count: p.count,
      rollingAvg: p.rollingAvg ?? p.count,
      isCurrentWeek: p.isCurrent ?? i === pattern.length - 1,
    };
  });
}

describe("VelocityChart", () => {
  it("renders nothing when weeks is empty", () => {
    const { container } = render(<VelocityChart weeks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every week has zero count and zero rolling avg", () => {
    const weeks = makeWeeks([
      { count: 0, rollingAvg: 0 },
      { count: 0, rollingAvg: 0 },
      { count: 0, rollingAvg: 0 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the SVG with the expected testid, role, and aria-label", () => {
    const weeks = makeWeeks([
      { count: 1 },
      { count: 2 },
      { count: 3 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const svg = container.querySelector("svg[data-testid='velocity-chart']");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(
      "Velocity chart showing tasks completed per week"
    );
    expect(svg?.getAttribute("viewBox")).toBe("0 0 280 110");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("renders one bar per week", () => {
    const weeks = makeWeeks([
      { count: 1 },
      { count: 0 },
      { count: 3 },
      { count: 2 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const bars = container.querySelectorAll("rect[data-testid='velocity-bar']");
    expect(bars.length).toBe(weeks.length);
  });

  it("renders the rolling-average polyline in indigo (#6366f1)", () => {
    const weeks = makeWeeks([
      { count: 1, rollingAvg: 1 },
      { count: 2, rollingAvg: 1.5 },
      { count: 3, rollingAvg: 2 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const poly = container.querySelector(
      "polyline[data-testid='velocity-rolling-avg']"
    );
    expect(poly).not.toBeNull();
    expect(poly?.getAttribute("stroke")).toBe("#6366f1");
    expect(poly?.getAttribute("fill")).toBe("none");
  });

  it("the current week bar uses lower opacity and a dashed outline", () => {
    const weeks = makeWeeks([
      { count: 2, isCurrent: false },
      { count: 3, isCurrent: false },
      { count: 1, isCurrent: true },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const bars = container.querySelectorAll("rect[data-testid='velocity-bar']");
    const currentBar = Array.from(bars).find(
      (b) => b.getAttribute("data-current") === "true"
    );
    const completedBar = Array.from(bars).find(
      (b) => b.getAttribute("data-current") === "false"
    );
    expect(currentBar).toBeDefined();
    expect(completedBar).toBeDefined();
    expect(parseFloat(currentBar!.getAttribute("fill-opacity") ?? "0")).toBeLessThan(
      parseFloat(completedBar!.getAttribute("fill-opacity") ?? "0")
    );
    expect(currentBar!.getAttribute("stroke-dasharray")).toBe("2 2");
  });

  it("renders the Y-axis max label as an integer with 'tasks' suffix", () => {
    const weeks = makeWeeks([
      { count: 1, rollingAvg: 1 },
      { count: 2, rollingAvg: 1.5 },
      { count: 5, rollingAvg: 3 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const label = container.querySelector(
      "[data-testid='velocity-ymax-label']"
    );
    expect(label?.textContent).toBe("5 tasks");
  });

  it("does not produce NaN coordinates when only one week has data", () => {
    const weeks = makeWeeks([
      { count: 0, rollingAvg: 0 },
      { count: 1, rollingAvg: 1 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const svg = container.querySelector("svg[data-testid='velocity-chart']");
    expect(svg).not.toBeNull();
    const html = svg?.outerHTML ?? "";
    expect(html).not.toContain("NaN");
  });

  it("does not draw the rolling-avg polyline when fewer than 2 points have non-zero avg", () => {
    const weeks = makeWeeks([
      { count: 0, rollingAvg: 0 },
      { count: 0, rollingAvg: 0 },
      { count: 2, rollingAvg: 0.67 },
    ]);
    const { container } = render(<VelocityChart weeks={weeks} />);
    const poly = container.querySelector(
      "polyline[data-testid='velocity-rolling-avg']"
    );
    expect(poly).toBeNull();
  });
});
