import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WorkingOnCard } from "./working-on-card";
import type { RedEyeState } from "@/lib/redeye-types";

// Mock next/link used inside BacklogId
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
});

function makeState(overrides: Partial<RedEyeState> = {}): RedEyeState {
  return {
    phase: "BUILD",
    phase_status: "in-progress",
    iteration: 1,
    backlog_item: null,
    backlog_title: null,
    last_updated: new Date().toISOString(),
    ...overrides,
  } as RedEyeState;
}

describe("WorkingOnCard — idle state", () => {
  it("renders idle message when not running and no task", () => {
    render(<WorkingOnCard state={null} running={false} />);
    expect(screen.getByText("RedEye is idle")).toBeTruthy();
  });
});

describe("WorkingOnCard — backlog empty stop state", () => {
  it("renders backlog-empty message when !running, phase=HARDEN, upNextCount=0", () => {
    const state = makeState({ phase: "HARDEN", backlog_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={0} />
    );
    expect(container.textContent).toContain("RedEye stopped — backlog empty.");
    expect(container.textContent).toContain("Add tasks to resume.");
    const amberDot = container.querySelector(".bg-amber-500");
    expect(amberDot).toBeTruthy();
  });

  it("renders plain idle when !running, phase=HARDEN, upNextCount=1", () => {
    const state = makeState({ phase: "HARDEN", backlog_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={1} />
    );
    expect(container.textContent).toContain("RedEye is idle");
    expect(container.textContent).not.toContain("backlog empty");
  });

  it("renders plain idle when !running, phase=BUILD, upNextCount=0", () => {
    const state = makeState({ phase: "BUILD", backlog_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={0} />
    );
    expect(container.textContent).toContain("RedEye is idle");
    expect(container.textContent).not.toContain("backlog empty");
  });
});

describe("WorkingOnCard — running with phase, no task", () => {
  it("renders phase badge with BUILD blue classes when running=true", () => {
    const state = makeState({ phase: "BUILD", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeTruthy();
  });

  it("has blue text class for BUILD phase", () => {
    const state = makeState({ phase: "BUILD", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-blue']");
    expect(badge).toBeTruthy();
  });

  it("has no shimmer class when running=false", () => {
    const state = makeState({ phase: "BUILD", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={false} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeNull();
  });

  it("has amber text class for REVIEW phase", () => {
    const state = makeState({ phase: "REVIEW", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-amber']");
    expect(badge).toBeTruthy();
  });

  it("has green text class for DEPLOY phase", () => {
    const state = makeState({ phase: "DEPLOY", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-green']");
    expect(badge).toBeTruthy();
  });

  it("has red text class for STABILIZE phase", () => {
    const state = makeState({ phase: "STABILIZE", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-red']");
    expect(badge).toBeTruthy();
  });

  it("animated dot is present when running=true", () => {
    const state = makeState({ phase: "BUILD", backlog_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const dot = container.querySelector(".animate-pulse.rounded-full");
    expect(dot).toBeTruthy();
  });
});

describe("WorkingOnCard — running with task", () => {
  it("renders task title", () => {
    const state = makeState({ phase: "BUILD", backlog_title: "My Feature", backlog_item: "BL-001" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("My Feature");
  });

  it("renders phase badge with shimmer when running=true and has task", () => {
    const state = makeState({ phase: "DEPLOY", backlog_title: "Ship it", backlog_item: "BL-002" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeTruthy();
  });

  it("badge has larger padding px-3 py-1", () => {
    const state = makeState({ phase: "BUILD", backlog_title: "Task", backlog_item: "BL-003" });
    const { container } = render(<WorkingOnCard state={state} running={false} />);
    const badge = container.querySelector("[class*='px-3'][class*='py-1']");
    expect(badge).toBeTruthy();
  });
});
