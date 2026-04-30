import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CostTrendChart } from "./cost-trend-chart";

afterEach(() => {
  cleanup();
});

const sampleSessions = [
  { cost: 1, mtimeMs: 1_000_000 },
  { cost: 2, mtimeMs: 2_000_000 },
  { cost: 3, mtimeMs: 3_000_000 },
];

const sampleProjection = [
  { sessionIndex: 3, cost: 2 },
  { sessionIndex: 4, cost: 2 },
  { sessionIndex: 5, cost: 2 },
  { sessionIndex: 6, cost: 2 },
  { sessionIndex: 7, cost: 2 },
];

describe("CostTrendChart", () => {
  it("renders nothing when fewer than 2 sessions are supplied", () => {
    const { container } = render(
      <CostTrendChart sessions={[]} projectedSessions={sampleProjection} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when only 1 session is supplied", () => {
    const { container } = render(
      <CostTrendChart
        sessions={[{ cost: 1, mtimeMs: 1000 }]}
        projectedSessions={sampleProjection}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders an SVG with the right test id and viewBox", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const svg = container.querySelector("svg[data-testid='cost-trend-chart']");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 280 100");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe(
      "Cost trend chart with projection"
    );
  });

  it("renders one bar per real session in currentColor", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const bars = container.querySelectorAll("rect[data-testid='trend-bar']");
    expect(bars.length).toBe(sampleSessions.length);
    for (const bar of Array.from(bars)) {
      expect(bar.getAttribute("fill")).toBe("currentColor");
    }
  });

  it("renders the projected polyline with amber stroke and dashed pattern", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const projection = container.querySelector(
      "polyline[data-testid='trend-projection']"
    );
    expect(projection).not.toBeNull();
    expect(projection?.getAttribute("stroke")).toBe("#f59e0b");
    expect(projection?.getAttribute("stroke-dasharray")).toBe("3 2");
  });

  it("draws a vertical separator between real and projected sections", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const separator = container.querySelector(
      "line[data-testid='trend-separator']"
    );
    expect(separator).not.toBeNull();
  });

  it("does not render a separator when no projected sessions are provided", () => {
    const { container } = render(
      <CostTrendChart sessions={sampleSessions} projectedSessions={[]} />
    );
    expect(
      container.querySelector("line[data-testid='trend-separator']")
    ).toBeNull();
  });

  it("renders one circle per projected point", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(sampleProjection.length);
  });

  it("does not produce NaN coordinates when all real costs are equal", () => {
    const { container } = render(
      <CostTrendChart
        sessions={[
          { cost: 5, mtimeMs: 1000 },
          { cost: 5, mtimeMs: 2000 },
          { cost: 5, mtimeMs: 3000 },
        ]}
        projectedSessions={[
          { sessionIndex: 3, cost: 5 },
          { sessionIndex: 4, cost: 5 },
          { sessionIndex: 5, cost: 5 },
          { sessionIndex: 6, cost: 5 },
          { sessionIndex: 7, cost: 5 },
        ]}
      />
    );
    const projection = container.querySelector(
      "polyline[data-testid='trend-projection']"
    );
    const points = projection?.getAttribute("points") ?? "";
    expect(points).not.toContain("NaN");
  });

  it("uses preserveAspectRatio so the chart doesn't horizontally stretch", () => {
    const { container } = render(
      <CostTrendChart
        sessions={sampleSessions}
        projectedSessions={sampleProjection}
      />
    );
    const svg = container.querySelector("svg[data-testid='cost-trend-chart']");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });
});
