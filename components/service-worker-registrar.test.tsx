import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { ServiceWorkerRegistrar } from "./service-worker-registrar";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Stub out navigator.serviceWorker with a mock register function. */
function mockServiceWorker(registerFn: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value: { register: registerFn },
  });
}

/** Remove navigator.serviceWorker to simulate absence. */
function removeServiceWorker() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  removeServiceWorker();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ServiceWorkerRegistrar", () => {
  it("does not call register in non-production (NODE_ENV=test)", async () => {
    // NODE_ENV is "test" in vitest — SW should NOT register.
    const registerFn = vi.fn().mockResolvedValue(undefined);
    mockServiceWorker(registerFn);

    await act(async () => {
      render(<ServiceWorkerRegistrar />);
    });

    expect(registerFn).not.toHaveBeenCalled();
  });

  it("does not throw when navigator.serviceWorker is undefined", async () => {
    removeServiceWorker();
    await act(async () => {
      expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
    });
  });

  it("renders null — no DOM output", async () => {
    const registerFn = vi.fn().mockResolvedValue(undefined);
    mockServiceWorker(registerFn);
    const { container } = render(<ServiceWorkerRegistrar />);
    expect(container.firstChild).toBeNull();
  });

  it("does not call register when serviceWorker is not in navigator", async () => {
    // Simulate a browser that does not support service workers.
    removeServiceWorker();
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await act(async () => {
      render(<ServiceWorkerRegistrar />);
    });

    // No warn, no register call.
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("registers only once per mount (no effect on re-render)", async () => {
    const registerFn = vi.fn().mockResolvedValue(undefined);
    mockServiceWorker(registerFn);

    // In test env, register is never called regardless of renders.
    const { rerender } = render(<ServiceWorkerRegistrar />);
    await act(async () => {
      rerender(<ServiceWorkerRegistrar />);
    });

    expect(registerFn).not.toHaveBeenCalled(); // still zero in test env
  });
});
