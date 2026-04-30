import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { OfflineBanner } from "./offline-banner";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Override navigator.onLine for a test. Returns the original value. */
function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Restore to online state between tests.
  setOnline(true);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OfflineBanner", () => {
  beforeEach(() => {
    setOnline(true);
  });

  it("renders nothing when navigator.onLine is true", () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("renders banner when navigator.onLine is false at mount", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });

  it("shows banner text when offline", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(
      screen.getByText(/no network connection/i)
    ).toBeTruthy();
  });

  it("shows banner when 'offline' event fires", async () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId("offline-banner")).toBeNull();

    await act(async () => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });

  it("hides banner when 'online' event fires after going offline", async () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByTestId("offline-banner")).toBeTruthy();

    await act(async () => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("has role='status' and aria-live='polite'", async () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("aria-live")).toBe("polite");
  });

  it("has data-testid='offline-banner'", async () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });

  it("removes event listeners on unmount", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<OfflineBanner />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });
});
