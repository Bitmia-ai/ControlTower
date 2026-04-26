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

describe("ProjectCard delete button aria-label (T024)", () => {
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

describe("ProjectCard precision instrument redesign (T066)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders project name", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    expect(container.textContent).toContain("haze");
  });

  it("applies green top border when running", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const card = container.querySelector('[data-status-border="running"]');
    expect(card).toBeTruthy();
    expect(card?.className).toMatch(/border-t-green-500/);
  });

  it("applies amber top border when idle with pending questions", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      running: false,
      questionCount: 3,
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    const card = container.querySelector('[data-status-border="attention"]');
    expect(card).toBeTruthy();
    expect(card?.className).toMatch(/border-t-amber-400/);
  });

  it("applies neutral top border when clean idle", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      running: false,
      questionCount: 0,
      phase: "BUILD",
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    const card = container.querySelector('[data-status-border="idle"]');
    expect(card).toBeTruthy();
  });

  it("renders pulsing dot indicator when running", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeTruthy();
  });

  it("does not render pulsing dot when not running", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      running: false,
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).toBeFalsy();
  });

  it("renders the question count badge when questionCount > 0", () => {
    const project: ProjectWithStatus = {
      ...baseProject,
      questionCount: 4,
    } as ProjectWithStatus;
    const { container } = render(
      <ProjectCard project={project} index={0} onToggle={vi.fn()} />
    );
    expect(container.textContent).toContain("4");
  });

  it("renders the path in monospace styling", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const pathEl = container.querySelector('[data-testid="project-path"]');
    expect(pathEl).toBeTruthy();
    expect(pathEl?.className).toMatch(/font-mono/);
    expect(pathEl?.textContent).toContain("/tmp/haze");
  });

  it("renders a phase footer strip with phase label", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const footer = container.querySelector('[data-testid="phase-footer"]');
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain("Building");
  });

  it("delete button is hover-reveal (opacity-0 group-hover:opacity-100)", () => {
    render(<ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Remove haze" });
    expect(btn.className).toMatch(/opacity-0/);
    expect(btn.className).toMatch(/group-hover:opacity-100/);
  });

  it("shows inline red-tinted delete confirmation panel when trash clicked", () => {
    const { container } = render(
      <ProjectCard project={baseProject} index={0} onToggle={vi.fn()} />
    );
    const trash = screen.getByRole("button", { name: "Remove haze" });
    fireEvent.click(trash);
    const panel = container.querySelector('[data-testid="delete-confirm-panel"]');
    expect(panel).toBeTruthy();
    expect(panel?.className).toMatch(/red/);
    expect(container.textContent).toContain("Remove haze");
  });
});
