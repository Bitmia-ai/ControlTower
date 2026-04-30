import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import OfflinePage from "./page";

afterEach(() => {
  cleanup();
});

describe("OfflinePage", () => {
  it("renders the 'You're offline' heading", () => {
    render(<OfflinePage />);
    expect(
      screen.getByRole("heading", { name: /you're offline/i })
    ).toBeTruthy();
  });

  it("renders a link to the home page", () => {
    render(<OfflinePage />);
    const link = screen.getByTestId("offline-home-link");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders with data-testid='offline-page'", () => {
    render(<OfflinePage />);
    expect(screen.getByTestId("offline-page")).toBeTruthy();
  });

  it("shows a helpful message about cached pages", () => {
    render(<OfflinePage />);
    expect(
      screen.getByText(/cached pages will load normally/i)
    ).toBeTruthy();
  });
});
