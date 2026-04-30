import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WorkingOnCard } from "./working-on-card";
import type { RedEyeState } from "@/lib/redeye-types";

// Mock next/link used inside TaskId
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
    task_id: null,
    task_title: null,
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

describe("WorkingOnCard — task list empty stop state", () => {
  it("renders no-tasks message when !running, phase=HARDEN, upNextCount=0", () => {
    const state = makeState({ phase: "HARDEN", task_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={0} />
    );
    expect(container.textContent).toContain("RedEye stopped — task list empty.");
    expect(container.textContent).toContain("Add tasks to resume.");
    const amberDot = container.querySelector(".bg-amber-500");
    expect(amberDot).toBeTruthy();
  });

  it("renders plain idle when !running, phase=HARDEN, upNextCount=1", () => {
    const state = makeState({ phase: "HARDEN", task_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={1} />
    );
    expect(container.textContent).toContain("RedEye is idle");
    expect(container.textContent).not.toContain("task list empty");
  });

  it("renders plain idle when !running, phase=BUILD, upNextCount=0", () => {
    const state = makeState({ phase: "BUILD", task_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={0} />
    );
    expect(container.textContent).toContain("RedEye is idle");
    expect(container.textContent).not.toContain("task list empty");
  });
});

describe("WorkingOnCard — running with phase, no task", () => {
  it("renders phase badge with BUILD blue classes when running=true", () => {
    const state = makeState({ phase: "BUILD", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeTruthy();
  });

  it("has blue text class for BUILD phase", () => {
    const state = makeState({ phase: "BUILD", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-blue']");
    expect(badge).toBeTruthy();
  });

  it("has no shimmer class when running=false", () => {
    const state = makeState({ phase: "BUILD", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={false} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeNull();
  });

  it("has amber text class for REVIEW phase", () => {
    const state = makeState({ phase: "REVIEW", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-amber']");
    expect(badge).toBeTruthy();
  });

  it("has green text class for DEPLOY phase", () => {
    const state = makeState({ phase: "DEPLOY", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-green']");
    expect(badge).toBeTruthy();
  });

  it("has red text class for STABILIZE phase", () => {
    const state = makeState({ phase: "STABILIZE", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-red']");
    expect(badge).toBeTruthy();
  });

  it("animated dot is present when running=true", () => {
    const state = makeState({ phase: "BUILD", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const dot = container.querySelector(".animate-pulse.rounded-full");
    expect(dot).toBeTruthy();
  });
});

describe("WorkingOnCard — T067 hero treatment", () => {
  it("uses p-6 and min-h-[160px] (hero padding/height)", () => {
    const state = makeState({ phase: "BUILD", task_title: "Task", task_id: "T001" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.className).toContain("p-6");
    expect(card?.className).toContain("min-h-[160px]");
  });

  it("applies green wash bg when running=true", () => {
    const state = makeState({ phase: "BUILD", task_title: "Task", task_id: "T001" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.className).toContain("bg-green-50/30");
  });

  it("does NOT apply green wash bg when running=false", () => {
    const state = makeState({ phase: "BUILD", task_title: "Task", task_id: "T001" });
    const { container } = render(<WorkingOnCard state={state} running={false} />);
    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.className).not.toContain("bg-green-50/30");
    expect(card?.className).toContain("bg-white");
  });

  it("renders task title with text-lg font-semibold (hero typography)", () => {
    const state = makeState({ phase: "BUILD", task_title: "My Feature", task_id: "T001" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const title = container.querySelector("p.text-lg.font-semibold");
    expect(title).toBeTruthy();
    expect(title?.textContent).toContain("My Feature");
  });
});

describe("WorkingOnCard — running with task", () => {
  it("renders task title", () => {
    const state = makeState({ phase: "BUILD", task_title: "My Feature", task_id: "T001" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("My Feature");
  });

  it("renders phase badge with shimmer when running=true and has task", () => {
    const state = makeState({ phase: "DEPLOY", task_title: "Ship it", task_id: "T002" });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector(".phase-badge-shimmer");
    expect(badge).toBeTruthy();
  });

  it("badge has larger padding px-3 py-1", () => {
    const state = makeState({ phase: "BUILD", task_title: "Task", task_id: "T003" });
    const { container } = render(<WorkingOnCard state={state} running={false} />);
    const badge = container.querySelector("[class*='px-3'][class*='py-1']");
    expect(badge).toBeTruthy();
  });
});

describe("WorkingOnCard — T085: lowercase phase normalization", () => {
  it("shows 'Building the feature' message for lowercase phase 'build'", () => {
    const state = makeState({ phase: "build", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Building the feature");
    expect(container.textContent).not.toContain("Starting up");
  });

  it("shows 'Reviewing the implementation' message for lowercase phase 'review'", () => {
    const state = makeState({ phase: "review", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Reviewing the implementation");
  });

  it("shows 'Triaging — picking the next task' for lowercase phase 'triage'", () => {
    const state = makeState({ phase: "triage", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Triaging — picking the next task");
  });

  it("shows 'Merging to main' for lowercase phase 'merge'", () => {
    const state = makeState({ phase: "merge", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Merging to main");
  });

  it("shows 'Deploying to production' for lowercase phase 'deploy'", () => {
    const state = makeState({ phase: "deploy", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Deploying to production");
  });

  it("shows 'Verifying the deployment' for lowercase phase 'verify'", () => {
    const state = makeState({ phase: "verify", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Verifying the deployment");
  });

  it("shows 'Planning the next task' for lowercase phase 'plan'", () => {
    const state = makeState({ phase: "plan", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    expect(container.textContent).toContain("Planning the next task");
  });

  it("renders blue badge for lowercase 'build' phase", () => {
    const state = makeState({ phase: "build", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-blue']");
    expect(badge).toBeTruthy();
  });

  it("renders amber badge for lowercase 'review' phase", () => {
    const state = makeState({ phase: "review", task_title: null });
    const { container } = render(<WorkingOnCard state={state} running={true} />);
    const badge = container.querySelector("[class*='text-amber']");
    expect(badge).toBeTruthy();
  });

  it("renders task list empty when !running and lowercase phase 'harden'", () => {
    const state = makeState({ phase: "harden", task_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={false} upNextCount={0} />
    );
    expect(container.textContent).toContain("RedEye stopped — task list empty.");
  });
});

describe("WorkingOnCard — T085: activeTaskTitle prop", () => {
  it("renders task title from activeTaskTitle when state.task_title is null", () => {
    const state = makeState({ phase: "build", task_title: null, task_id: "T085" });
    const { container } = render(
      <WorkingOnCard
        state={state}
        running={true}
        activeTaskTitle="WorkingOn card phase case fix"
      />
    );
    expect(container.textContent).toContain("WorkingOn card phase case fix");
  });

  it("renders rich task row (not phase-only message) when activeTaskTitle is provided", () => {
    const state = makeState({ phase: "build", task_title: null, task_id: "T085" });
    const { container } = render(
      <WorkingOnCard
        state={state}
        running={true}
        activeTaskTitle="My Active Task"
      />
    );
    // Rich branch uses text-lg font-semibold paragraph
    const title = container.querySelector("p.text-lg.font-semibold");
    expect(title).toBeTruthy();
    expect(title?.textContent).toContain("My Active Task");
    // Should NOT show the phase-only message fallback
    expect(container.textContent).not.toContain("Starting up");
    expect(container.textContent).not.toContain("Building the feature");
  });

  it("prefers state.task_title over activeTaskTitle when both are present", () => {
    const state = makeState({ phase: "build", task_title: "From State", task_id: "T085" });
    const { container } = render(
      <WorkingOnCard
        state={state}
        running={true}
        activeTaskTitle="From ActiveItem"
      />
    );
    expect(container.textContent).toContain("From State");
    expect(container.textContent).not.toContain("From ActiveItem");
  });

  it("shows phase-only message when running=true, no task_title, and no activeTaskTitle", () => {
    const state = makeState({ phase: "build", task_title: null });
    const { container } = render(
      <WorkingOnCard state={state} running={true} activeTaskTitle={null} />
    );
    expect(container.textContent).toContain("Building the feature");
    expect(container.textContent).not.toContain("Starting up");
  });
});
