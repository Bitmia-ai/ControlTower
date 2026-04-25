import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SparklineChart } from "./sparkline-chart";

afterEach(() => {
  cleanup();
});

describe("SparklineChart", () => {
  it("renders null when sessions is empty", () => {
    const { container } = render(<SparklineChart sessions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when only one session is provided", () => {
    const { container } = render(
      <SparklineChart sessions={[{ cost: 1, mtimeMs: 1000 }]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders an SVG with polyline when 2+ sessions provided", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: 1_000_000 },
          { cost: 2, mtimeMs: 2_000_000 },
          { cost: 3, mtimeMs: 3_000_000 },
        ]}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 200 80");
    expect(svg?.getAttribute("height")).toBe("80");

    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    const points = polyline?.getAttribute("points") ?? "";
    // Three points → 3 coordinate pairs separated by space
    const pairs = points.trim().split(/\s+/);
    expect(pairs).toHaveLength(3);
  });

  it("uses fixed height and preserveAspectRatio to avoid horizontal stretching", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: 1_000_000 },
          { cost: 2, mtimeMs: 2_000_000 },
        ]}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
    // Fixed height attribute — SVG renders at natural height without distortion
    expect(svg?.getAttribute("height")).toBe("80");
    // No explicit width — browser auto-sizes width proportionally from height
    expect(svg?.getAttribute("width")).toBeNull();
  });

  it("normalizes points across min/max with first point on baseline-relative low", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 0, mtimeMs: 1_000_000 },
          { cost: 10, mtimeMs: 2_000_000 },
        ]}
      />
    );
    const polyline = container.querySelector("polyline");
    const points = polyline?.getAttribute("points") ?? "";
    const pairs = points.trim().split(/\s+/).map((p) => p.split(",").map(Number));
    // First point (cost=0) should have higher y (lower on screen) than second (cost=10)
    expect(pairs[0][1]).toBeGreaterThan(pairs[1][1]);
    // X positions: first close to 0, last close to 200
    expect(pairs[0][0]).toBeLessThan(pairs[1][0]);
  });

  it("renders date labels formatted as 'MMM D' for each session", () => {
    // 2026-04-24 12:00 UTC ≈ specific Date — use locales-agnostic check
    const apr24 = new Date(2026, 3, 24).getTime(); // local Apr 24 2026
    const apr25 = new Date(2026, 3, 25).getTime();
    render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: apr24 },
          { cost: 2, mtimeMs: apr25 },
        ]}
      />
    );
    // Labels rendered as "Apr 24" / "Apr 25"
    expect(screen.getByText("Apr 24")).toBeTruthy();
    expect(screen.getByText("Apr 25")).toBeTruthy();
  });

  it("uses currentColor for the polyline stroke", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: 1_000_000 },
          { cost: 2, mtimeMs: 2_000_000 },
        ]}
      />
    );
    const polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toBe("currentColor");
  });

  it("renders a circle marker per data point", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: 1_000_000 },
          { cost: 2, mtimeMs: 2_000_000 },
          { cost: 3, mtimeMs: 3_000_000 },
        ]}
      />
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(3);
  });

  it("handles all-equal values without NaN coordinates", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 5, mtimeMs: 1_000_000 },
          { cost: 5, mtimeMs: 2_000_000 },
        ]}
      />
    );
    const polyline = container.querySelector("polyline");
    const points = polyline?.getAttribute("points") ?? "";
    expect(points).not.toContain("NaN");
  });

  it("includes data-testid='sparkline' on the SVG", () => {
    const { container } = render(
      <SparklineChart
        sessions={[
          { cost: 1, mtimeMs: 1_000_000 },
          { cost: 2, mtimeMs: 2_000_000 },
        ]}
      />
    );
    expect(container.querySelector("svg[data-testid='sparkline']")).not.toBeNull();
  });
});
