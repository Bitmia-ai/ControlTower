import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { InstallBanner, INSTALL_BANNER_DISMISS_KEY } from "./install-banner";

// -----------------------------------------------------------------------
// Minimal sessionStorage stub (jsdom provides a real one, but we reset it)
// -----------------------------------------------------------------------

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// Helper: fire a fake beforeinstallprompt event on window
function fireFakePrompt(
  promptFn = vi.fn().mockResolvedValue(undefined),
  outcome: "accepted" | "dismissed" = "accepted",
) {
  const event = new Event("beforeinstallprompt");
  (event as unknown as Record<string, unknown>).prompt = promptFn;
  (event as unknown as Record<string, unknown>).userChoice = Promise.resolve({
    outcome,
  });
  window.dispatchEvent(event);
  return { event, promptFn };
}

describe("InstallBanner", () => {
  it("renders nothing when beforeinstallprompt has not fired", () => {
    render(<InstallBanner />);
    expect(screen.queryByTestId("install-banner")).toBeNull();
  });

  it("shows banner when beforeinstallprompt fires", async () => {
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt();
    });
    expect(screen.getByTestId("install-banner")).toBeTruthy();
  });

  it("calls prompt() and dismisses on Install click", async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt(promptFn, "accepted");
    });
    const installBtn = screen.getByTestId("install-banner-install-btn");
    await act(async () => {
      fireEvent.click(installBtn);
    });
    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("install-banner")).toBeNull();
  });

  it("dismisses without calling prompt() on X click", async () => {
    const promptFn = vi.fn().mockResolvedValue(undefined);
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt(promptFn, "dismissed");
    });
    const dismissBtn = screen.getByTestId("install-banner-dismiss-btn");
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
    expect(promptFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("install-banner")).toBeNull();
  });

  it("sets sessionStorage key on dismiss", async () => {
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("install-banner-dismiss-btn"));
    });
    expect(sessionStorage.getItem(INSTALL_BANNER_DISMISS_KEY)).toBe("1");
  });

  it("stays hidden when sessionStorage key is already set", async () => {
    sessionStorage.setItem(INSTALL_BANNER_DISMISS_KEY, "1");
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt();
    });
    // Dismiss key was present at mount time — banner should remain hidden.
    expect(screen.queryByTestId("install-banner")).toBeNull();
  });

  it("has accessible role=region and aria-label", async () => {
    render(<InstallBanner />);
    await act(async () => {
      fireFakePrompt();
    });
    const banner = screen.getByRole("region", {
      name: /install control tower/i,
    });
    expect(banner).toBeTruthy();
  });
});
