/**
 * T057: Mobile-responsive layout — class-assertion smoke tests.
 *
 * These tests guard against regressions in the responsive Tailwind classes
 * that ensure the dashboard works on mobile (≥320px) and tablet (≥768px)
 * viewports. They do not measure layout — they only verify that the expected
 * responsive utility classes are present after render.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProjectCard } from "../project-card";
import { ProjectNav } from "../project-nav";
import { SparklineChart } from "../mission-control/sparkline-chart";
import { ControlsCard } from "../mission-control/controls-card";
import type { ProjectWithStatus } from "@/lib/redeye-types";

// Mock next/navigation for components that use useRouter / usePathname.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/project/1",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

const baseProject: ProjectWithStatus = {
  name: "haze",
  path: "/tmp/haze",
  initialized: true,
  running: false,
  phase: "BUILD",
  currentTask: null,
  questionCount: 0,
  sessionStatus: { cto: { status: "stopped" } },
} as unknown as ProjectWithStatus;

describe("T057 responsive classes", () => {
  it("ProjectCard Start/Stop button has min-h-[44px] for touch target", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Start"
    );
    expect(startBtn).toBeTruthy();
    expect(startBtn?.className).toContain("min-h-[44px]");
  });

  it("ProjectNav has overflow-x-auto for horizontal scroll on narrow screens", () => {
    const { container } = render(<ProjectNav projectId="1" />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("overflow-x-auto");
  });

  it("SparklineChart SVG uses fixed height (no horizontal distortion)", () => {
    const sessions = [
      { cost: 0.1, mtimeMs: 1_700_000_000_000 },
      { cost: 0.2, mtimeMs: 1_700_001_000_000 },
      { cost: 0.15, mtimeMs: 1_700_002_000_000 },
    ];
    const { container } = render(<SparklineChart sessions={sessions} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    // Fixed height prevents the SVG from stretching horizontally across wide containers.
    expect(svg?.getAttribute("height")).toBe("80");
    // viewBox guarantees correct internal scaling
    expect(svg?.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
  });

  it("ControlsCard Start button has min-h-[44px] touch target", () => {
    const { container } = render(
      <ControlsCard
        running={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onPause={vi.fn()}
      />
    );
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().startsWith("Start")
    );
    expect(startBtn).toBeTruthy();
    expect(startBtn?.className).toContain("min-h-[44px]");
  });

  // T097: The "ControlsCard button row uses flex-wrap" test was deleted because
  // T083 intentionally removed flex-wrap from ControlsCard to fix alignment at
  // the 300px right-rail width. Wrapping at 300px caused layout problems. The
  // responsive intent is served by the min-h-[44px] touch-target test above.
});
