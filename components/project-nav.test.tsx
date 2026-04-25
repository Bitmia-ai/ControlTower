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
  it("renders all five nav tabs", () => {
    render(<ProjectNav projectId="1" />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Backlog")).toBeTruthy();
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Schedules")).toBeTruthy();
  });

  it("highlights Overview tab when on project root", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    render(<ProjectNav projectId="1" />);
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.className).toContain("border-red-600");
  });

  it("highlights Backlog tab when on backlog page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/backlog");
    render(<ProjectNav projectId="1" />);
    const backlogLink = screen.getByText("Backlog").closest("a");
    expect(backlogLink?.className).toContain("border-red-600");

    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink?.className).toContain("border-transparent");
  });

  it("highlights Backlog tab on backlog detail page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/backlog/BL-001");
    render(<ProjectNav projectId="1" />);
    const backlogLink = screen.getByText("Backlog").closest("a");
    expect(backlogLink?.className).toContain("border-red-600");
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
    expect(screen.getByText("Backlog").closest("a")?.getAttribute("href")).toBe("/project/42/backlog");
    expect(screen.getByText("History").closest("a")?.getAttribute("href")).toBe("/project/42/history");
    expect(screen.getByText("Live").closest("a")?.getAttribute("href")).toBe("/project/42/live");
    expect(screen.getByText("Schedules").closest("a")?.getAttribute("href")).toBe("/project/42/schedules");
  });

  it("highlights Schedules tab when on schedules page", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1/schedules");
    render(<ProjectNav projectId="1" />);
    const schedulesLink = screen.getByText("Schedules").closest("a");
    expect(schedulesLink?.className).toContain("border-red-600");
  });

  it("has overflow-x-auto for responsive scrolling", () => {
    vi.mocked(usePathname).mockReturnValue("/project/1");
    const { container } = render(<ProjectNav projectId="1" />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("overflow-x-auto");
  });
});
