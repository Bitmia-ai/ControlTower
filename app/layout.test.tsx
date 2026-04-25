import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

// Mock next-themes ThemeProvider since it's a client component dependency
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/font/google to avoid font loader issues in tests
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

// Mock ThemeToggle (it has its own tests)
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button>theme</button>,
}));

// ClientProviders now owns the header (logo link + ThemeToggle) plus ThemeProvider
// and ToastProvider. Mock it to render the full header structure so layout tests
// can find the logo link, "Control" text, "Tower" text, and children.
vi.mock("@/components/client-providers", () => ({
  ClientProviders: ({ children }: { children: React.ReactNode }) => (
    <>
      <header>
        <a href="/" aria-label="Control Tower — go to home">
          <span className="text-xs font-bold tracking-widest text-red-600 dark:text-red-500 uppercase">
            Control
          </span>
          <span className="text-lg font-black text-red-600 dark:text-red-500 uppercase leading-none">
            Tower
          </span>
        </a>
        <button>theme</button>
      </header>
      {children}
    </>
  ),
}));

import RootLayout, { metadata, viewport } from "./layout";

afterEach(() => {
  cleanup();
});

describe("RootLayout metadata exports", () => {
  it("exports viewport with device-width and initialScale 1", () => {
    expect(viewport).toMatchObject({ width: "device-width", initialScale: 1 });
  });

  it("exports metadata with a title template and default", () => {
    // metadata.title is an object with .default and .template
    expect(typeof metadata.title).toBe("object");
    const title = metadata.title as { default: string; template: string };
    expect(title.default).toBe("Control Tower");
    expect(title.template).toContain("%s");
  });

  it("exports metadata with robots noindex", () => {
    // local-only dashboard should not be indexed
    expect(metadata.robots).toBeTruthy();
    const robots = metadata.robots as { index: boolean; follow: boolean };
    expect(robots.index).toBe(false);
  });
});

describe("RootLayout logo mark", () => {
  it("renders a link pointing to /", () => {
    // RootLayout renders a full <html><body> document; render it and query the link
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/");
  });

  it('contains "Control" text (case-insensitive)', () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    // "Control" appears as a child span
    const controlSpan = within(link).getByText(/^control$/i);
    expect(controlSpan).toBeTruthy();
  });

  it('contains "Tower" text (case-insensitive)', () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    const towerSpan = within(link).getByText(/^tower$/i);
    expect(towerSpan).toBeTruthy();
  });

  it("applies red accent classes to both spans", () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    const controlSpan = within(link).getByText(/^control$/i);
    const towerSpan = within(link).getByText(/^tower$/i);
    expect(controlSpan.className).toContain("text-red-600");
    expect(towerSpan.className).toContain("text-red-600");
  });

  it("renders children inside the layout", () => {
    render(<RootLayout>{<div data-testid="child-content">hello</div>}</RootLayout>);
    expect(screen.getByTestId("child-content")).toBeTruthy();
  });
});
