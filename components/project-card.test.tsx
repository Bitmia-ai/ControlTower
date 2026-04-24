import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ProjectCard } from "./project-card";
import type { ProjectWithStatus } from "@/lib/redeye-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProject: ProjectWithStatus = {
  name: "haze",
  path: "/tmp/haze",
  initialized: true,
  running: true,
  phase: "BUILD",
  currentTask: null,
  questionCount: 0,
  sessionStatus: { cto: { status: "running" } },
} as unknown as ProjectWithStatus;

describe("ProjectCard backlog-empty label", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows 'Backlog empty' label with amber dot when !running and phase=HARDEN", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      running: false,
      phase: "HARDEN",
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    expect(container.textContent).toContain("Backlog empty");
    expect(container.querySelector(".bg-amber-500")).toBeTruthy();
  });

  it("does not show 'Backlog empty' when !running and phase=BUILD", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      running: false,
      phase: "BUILD",
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    expect(container.textContent).not.toContain("Backlog empty");
  });
});

describe("ProjectCard delete button aria-label (BL-024)", () => {
  afterEach(() => {
    cleanup();
  });

  it("Trash2 delete button has aria-label including the project name", () => {
    render(<ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />);
    // Resolves only if the icon-only button has accessible name "Remove haze"
    const btn = screen.getByRole("button", { name: "Remove haze" });
    expect(btn).toBeTruthy();
  });
});

describe("ProjectCard Stop feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows Stopping… when Stop is clicked on home card", async () => {
    const onToggle = vi.fn();
    render(<ProjectCard project={baseProject} index={0} onToggle={onToggle} />);

    const btn = screen.getByRole("button", { name: /^Stop$/ });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(onToggle).toHaveBeenCalledWith(0);
    const stopping = screen.getByRole("button", { name: /Stopping/ }) as HTMLButtonElement;
    expect(stopping.disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    const reverted = screen.getByRole("button", { name: /^Stop$/ }) as HTMLButtonElement;
    expect(reverted.disabled).toBe(false);
  });
});
