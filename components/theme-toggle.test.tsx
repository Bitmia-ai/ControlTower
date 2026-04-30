import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/lib/theme-context", () => ({
  useTheme: vi.fn(() => ({ theme: "system", setTheme: vi.fn(), resolvedTheme: "dark", systemTheme: "dark" })),
}));

import { ThemeToggle } from "./theme-toggle";
import { useTheme } from "@/lib/theme-context";

afterEach(() => {
  cleanup();
});

describe("ThemeToggle", () => {
  it("renders without crashing", () => {
    const { container } = render(<ThemeToggle />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a button", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn).toBeTruthy();
  });

  it("cycles from system to light on click", () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "system", setTheme, resolvedTheme: "dark", systemTheme: "dark" });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("cycles from light to dark on click", () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "light", setTheme, resolvedTheme: "light", systemTheme: "dark" });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("cycles from dark to system on click", () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "dark", setTheme, resolvedTheme: "dark", systemTheme: "dark" });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("system");
  });
});
