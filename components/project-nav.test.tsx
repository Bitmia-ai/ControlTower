import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/project/1"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

import { ProjectNav } from "./project-nav";
import { usePathname } from "next/navigation";

afterEach(() => {
  cleanup();
});

describe("ProjectNav", () => {
  it("renders all six nav tabs", () => {
    render(<ProjectNav projectId="1" />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Schedules")).toBeTruthy();
    expect(screen.getByText("Steer")).toBeTruthy();
  });

  it("highlights Overview tab when on project root", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    render(<ProjectNav projectId="1" />);
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.className).toContain("border-red-600");
  });

  it("highlights Tasks tab when on tasks page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/tasks");
    render(<ProjectNav projectId="1" />);
    const tasksLink = screen.getByText("Tasks").closest("a");
    expect(tasksLink?.className).toContain("border-red-600");

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.className).toContain("border-transparent");
  });

  it("highlights Tasks tab on task detail page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/tasks/T001");
    render(<ProjectNav projectId="1" />);
    const tasksLink = screen.getByText("Tasks").closest("a");
    expect(tasksLink?.className).toContain("border-red-600");
  });

  it("highlights History tab when on history page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/history");
    render(<ProjectNav projectId="1" />);
    const historyLink = screen.getByText("History").closest("a");
    expect(historyLink?.className).toContain("border-red-600");
  });

  it("highlights Live tab when on live page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/live");
    render(<ProjectNav projectId="1" />);
    const liveLink = screen.getByText("Live").closest("a");
    expect(liveLink?.className).toContain("border-red-600");
  });

  it("generates correct hrefs for tabs", () => {
    vi.mocked(usePathname).mockReturnValue("/project/42");
    render(<ProjectNav projectId="42" />);
    expect(screen.getByText("Overview").closest("a")?.getAttribute("href")).toBe("/project/42");
    expect(screen.getByText("Tasks").closest("a")?.getAttribute("href")).toBe("/project/42/tasks");
    expect(screen.getByText("History").closest("a")?.getAttribute("href")).toBe("/project/42/history");
    expect(screen.getByText("Live").closest("a")?.getAttribute("href")).toBe("/project/42/live");
    expect(screen.getByText("Schedules").closest("a")?.getAttribute("href")).toBe("/project/42/schedules");
    expect(screen.getByText("Steer").closest("a")?.getAttribute("href")).toBe("/project/42/steer");
  });

  it("highlights Schedules tab when on schedules page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/schedules");
    render(<ProjectNav projectId="1" />);
    const schedulesLink = screen.getByText("Schedules").closest("a");
    expect(schedulesLink?.className).toContain("border-red-600");
  });

  it("highlights Steer tab when on steer page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/steer");
    render(<ProjectNav projectId="1" />);
    const steerLink = screen.getByText("Steer").closest("a");
    expect(steerLink?.className).toContain("border-red-600");
  });

  it("does not highlight Steer tab on other pages", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/schedules");
    render(<ProjectNav projectId="1" />);
    const steerLink = screen.getByText("Steer").closest("a");
    expect(steerLink?.className).toContain("border-transparent");
  });

  it("has overflow-x-auto for responsive scrolling", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    const { container } = render(<ProjectNav projectId="1" />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("overflow-x-auto");
  });

  it("has scrollbar-none on the nav for hidden scrollbar", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    const { container } = render(<ProjectNav projectId="1" />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("scrollbar-none");
  });

  it("renders the right-fade gradient overlay", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    render(<ProjectNav projectId="1" />);
    const gradient = screen.getByTestId("nav-fade-gradient");
    expect(gradient).toBeTruthy();
    expect(gradient.getAttribute("aria-hidden")).toBe("true");
    expect(gradient.className).toContain("bg-gradient-to-l");
  });
});
