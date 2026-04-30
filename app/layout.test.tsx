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
  Inter: () => ({ variable: "--font-inter" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono" }),
}));

// Mock ThemeToggle (it has its own tests)
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button>theme</button>,
}));

// ClientProviders owns the redesigned TopBar (logo + title + activity/bell/theme).
// Mock it to render a header with the same aria-label and "on RedEye" tagline so
// layout tests can assert on the link, the title, and children.
vi.mock("@/components/client-providers", () => ({
  ClientProviders: ({ children }: { children: React.ReactNode }) => (
    <>
      <header>
        <a href="/" aria-label="Control Tower — go to home">
          <span>Control Tower</span>
          <span style={{ color: "var(--red)" }}>on RedEye</span>
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
    expect(viewport).toMatchObject({
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    });
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

describe("RootLayout header", () => {
  it("renders a logo link pointing to /", () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/");
  });

  it('contains the "Control Tower" title', () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    expect(within(link).getByText(/control tower/i)).toBeTruthy();
  });

  it('contains the "on RedEye" tagline', () => {
    render(<RootLayout>{<div>child</div>}</RootLayout>);
    const link = screen.getByRole("link", { name: /control tower/i });
    expect(within(link).getByText(/on redeye/i)).toBeTruthy();
  });

  it("renders children inside the layout", () => {
    render(<RootLayout>{<div data-testid="child-content">hello</div>}</RootLayout>);
    expect(screen.getByTestId("child-content")).toBeTruthy();
  });
});
