/**
 * Smoke tests for ClientProviders — ensures the NotificationBell + drawer
 * are wired into the header tree (T113).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

function makeStorage(): Storage {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
    key: (i) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length; },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ data: { notifications: [] } }), { status: 200, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ClientProviders", () => {
  it("renders NotificationBell in the header", async () => {
    const { ClientProviders } = await import("./client-providers");
    render(
      <ClientProviders>
        <div>app body</div>
      </ClientProviders>,
    );
    expect(screen.getByTestId("notification-bell")).toBeTruthy();
    expect(screen.getByText("app body")).toBeTruthy();
  });

  it("does not render the drawer until isOpen flips true", async () => {
    const { ClientProviders } = await import("./client-providers");
    render(
      <ClientProviders>
        <div>x</div>
      </ClientProviders>,
    );
    // Drawer hidden by default (returns null when closed)
    expect(screen.queryByTestId("notification-drawer")).toBeFalsy();
  });
});
