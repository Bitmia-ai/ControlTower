/**
 * Tests for lib/use-notifications.ts + components/notifications-provider.tsx.
 *
 * The hook is exposed via the NotificationsProvider context. We render the
 * provider, drive `setInterval` with fake timers, and stub `fetch` to control
 * server responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  NotificationsProvider,
  useNotificationsContext,
} from "@/components/notifications-provider";
import { ToastProvider } from "@/components/toast-provider";
import type { NotificationItem } from "./redeye-types";

const ORIG_FETCH = global.fetch;

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

function Probe() {
  const ctx = useNotificationsContext();
  return (
    <>
      <div data-testid="count">{ctx.notifications.length}</div>
      <div data-testid="unread">{ctx.unreadCount}</div>
      <div data-testid="open">{String(ctx.isOpen)}</div>
      <button data-testid="mark" onClick={ctx.markAllRead}>mark</button>
      <button data-testid="opener" onClick={() => ctx.setIsOpen(true)}>open</button>
    </>
  );
}

function ToastProbe() {
  // Renders the ToastProvider's container so we can assert toast text.
  return <div data-testid="toast-host" />;
}

function buildItems(...specs: Array<{ id: string; tsMs: number }>): NotificationItem[] {
  return specs.map(({ id, tsMs }) => ({
    id,
    type: "task-complete" as const,
    projectId: 0,
    projectName: "p",
    message: `msg-${id}`,
    timestamp: new Date(tsMs).toISOString(),
    taskId: null,
  }));
}

function mockFetchSequence(responses: NotificationItem[][]) {
  let i = 0;
  global.fetch = vi.fn(async () => {
    const data = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify({ data: { notifications: data } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <NotificationsProvider>
        <Probe />
        <ToastProbe />
      </NotificationsProvider>
    </ToastProvider>,
  );
}

describe("NotificationsProvider / useNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", makeStorage());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    global.fetch = ORIG_FETCH;
  });

  it("on mount: fetches buffered events without firing toasts", async () => {
    const items = buildItems({ id: "a", tsMs: 1000 }, { id: "b", tsMs: 2000 });
    mockFetchSequence([items]);

    renderWithProvider();

    // Allow initial fetch microtasks to flush
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("count").textContent).toBe("2");
    // Toasts come from ToastContainer — not present for buffered/initial events
    expect(screen.queryByText("msg-a")).toBeFalsy();
    expect(screen.queryByText("msg-b")).toBeFalsy();
  });

  it("subsequent poll fires toasts for new events", async () => {
    const initial = buildItems({ id: "a", tsMs: 1000 });
    const newer = buildItems({ id: "b", tsMs: Date.now() + 5000 });
    mockFetchSequence([initial, newer]);

    renderWithProvider();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("count").textContent).toBe("2");
    // New event b should have surfaced a toast
    expect(screen.queryByText("msg-b")).toBeTruthy();
  });

  it("unreadCount reflects events not yet marked read", async () => {
    const items = buildItems({ id: "a", tsMs: 1 }, { id: "b", tsMs: 2 });
    mockFetchSequence([items]);
    renderWithProvider();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("unread").textContent).toBe("2");

    act(() => {
      screen.getByTestId("mark").click();
    });
    expect(screen.getByTestId("unread").textContent).toBe("0");
  });

  it("read state persists in localStorage across remount", async () => {
    const items = buildItems({ id: "a", tsMs: 1 });
    mockFetchSequence([items, items]);

    const { unmount } = renderWithProvider();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      screen.getByTestId("mark").click();
    });
    expect(screen.getByTestId("unread").textContent).toBe("0");

    unmount();
    cleanup();

    renderWithProvider();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("unread").textContent).toBe("0");
  });

  it("setIsOpen toggles drawer state", async () => {
    mockFetchSequence([[]]);
    renderWithProvider();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("open").textContent).toBe("false");
    act(() => {
      screen.getByTestId("opener").click();
    });
    expect(screen.getByTestId("open").textContent).toBe("true");
  });

  it("does not refetch while document.visibilityState === 'hidden'", async () => {
    mockFetchSequence([[]]);
    renderWithProvider();
    await act(async () => {
      await Promise.resolve();
    });

    const initialCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    // Simulate hidden tab.
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      vi.advanceTimersByTime(15000);
      await Promise.resolve();
    });
    const callsAfter = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(initialCalls);

    // Restore visibilityState
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
});
