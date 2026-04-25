/**
 * BL-052: Keyboard-shortcut hint badges on project nav tabs.
 *
 * The project layout renders ProjectNav for the Overview/Backlog/History/Live
 * tabs. This test verifies the <kbd> hint badges (GB, GH, GL) appear on the
 * three navigation targets and are aria-hidden so they do not affect the
 * accessible name of each nav link.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectNav } from "@/components/project-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/project/42",
}));

describe("ProjectNav kbd hint badges (BL-052)", () => {
  afterEach(() => cleanup());

  it("Backlog link contains a <kbd> with text 'GB'", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^Backlog$/ });
    const kbd = link.querySelector("kbd");
    expect(kbd).toBeTruthy();
    expect(kbd?.textContent).toBe("GB");
    expect(kbd?.getAttribute("aria-hidden")).toBe("true");
  });

  it("History link contains a <kbd> with text 'GH'", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^History$/ });
    const kbd = link.querySelector("kbd");
    expect(kbd).toBeTruthy();
    expect(kbd?.textContent).toBe("GH");
    expect(kbd?.getAttribute("aria-hidden")).toBe("true");
  });

  it("Live link contains a <kbd> with text 'GL'", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^Live$/ });
    const kbd = link.querySelector("kbd");
    expect(kbd).toBeTruthy();
    expect(kbd?.textContent).toBe("GL");
    expect(kbd?.getAttribute("aria-hidden")).toBe("true");
  });

  it("Overview link has NO kbd badge (no shortcut assigned)", () => {
    render(<ProjectNav projectId="42" />);
    const link = screen.getByRole("link", { name: /^Overview$/ });
    expect(link.querySelector("kbd")).toBeNull();
  });
});
