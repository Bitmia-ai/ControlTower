/**
 * T061: Keyboard-shortcut hint badges removed from project nav tabs.
 *
 * Verifies that no <kbd> elements appear in any nav link after T061 removal.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectNav } from "@/components/project-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/project/42",
}));

describe("ProjectNav — no kbd badges (T061)", () => {
  afterEach(() => cleanup());

  it("no nav link contains a <kbd> element", () => {
    const { container } = render(<ProjectNav projectId="42" />);
    const kbdElements = container.querySelectorAll("kbd");
    expect(kbdElements.length).toBe(0);
  });

  it("Overview link has no kbd badge", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^Overview$/ });
    expect(link.querySelector("kbd")).toBeNull();
  });

  it("Tasks link has no kbd badge", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^Tasks$/ });
    expect(link.querySelector("kbd")).toBeNull();
  });
});
