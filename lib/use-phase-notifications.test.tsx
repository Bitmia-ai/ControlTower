import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "../components/toast-provider";
import { usePhaseNotifications, NOTIFIABLE_PHASES } from "./use-phase-notifications";

// Use a real ToastProvider but inject a spy that wraps the underlying showToast
// by mocking the module that exports useToast. We mock the module to inject a
// spy showToast while still rendering ToastProvider normally so the React
// context structure stays intact.
const showToastSpy = vi.fn();

vi.mock("@/components/toast-provider", async () => {
  const actual = await vi.importActual<typeof import("../components/toast-provider")>(
    "../components/toast-provider"
  );
  return {
    ...actual,
    useToast: () => ({
      toasts: [],
      showToast: showToastSpy,
      dismissToast: vi.fn(),
    }),
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

// Mock global Notification API
type MockNotificationCtor = ReturnType<typeof vi.fn> & {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
};

function setupNotification(permission: NotificationPermission = "default") {
  const ctor = vi.fn() as unknown as MockNotificationCtor;
  ctor.permission = permission;
  ctor.requestPermission = vi.fn().mockResolvedValue(permission);
  // @ts-expect-error overwrite global
  globalThis.Notification = ctor;
  return ctor;
}

describe("usePhaseNotifications", () => {
  beforeEach(() => {
    showToastSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error cleanup
    delete globalThis.Notification;
  });

  it("exports NOTIFIABLE_PHASES with expected entries", () => {
    expect(NOTIFIABLE_PHASES.has("BUILD")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("REVIEW")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("DEPLOY")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("MERGE")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("VERIFY")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("STABILIZE")).toBe(true);
    expect(NOTIFIABLE_PHASES.has("TRIAGE")).toBe(false);
    expect(NOTIFIABLE_PHASES.has("PLAN")).toBe(false);
    expect(NOTIFIABLE_PHASES.has("HARDEN")).toBe(false);
  });

  it("does not fire toast on first mount with a notifiable phase", () => {
    setupNotification("default");

    renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: { phase: "BUILD", title: "Some task" },
      }
    );

    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it("PLAN -> BUILD transition: fires showToast with BUILD message and live href", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 7),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "PLAN" as string | null,
          title: "Spec it" as string | null,
        },
      }
    );

    rerender({ phase: "BUILD", title: "Build it" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    const [message, href] = showToastSpy.mock.calls[0];
    expect(message).toMatch(/BUILD/);
    expect(message).toMatch(/Build it/);
    expect(href).toBe("/project/7/live");
  });

  it("BUILD -> TRIAGE transition: does NOT fire toast (TRIAGE not notifiable)", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "BUILD" as string | null,
          title: "X" as string | null,
        },
      }
    );

    rerender({ phase: "TRIAGE", title: "X" });

    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it("BUILD -> REVIEW transition fires toast", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "BUILD" as string | null,
          title: "X" as string | null,
        },
      }
    );

    rerender({ phase: "REVIEW", title: "X" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    const [message] = showToastSpy.mock.calls[0];
    expect(message).toMatch(/REVIEW/);
  });

  it("VERIFY transition uses same 'completed' phrasing as MERGE", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "DEPLOY" as string | null,
          title: "Verify it" as string | null,
        },
      }
    );

    rerender({ phase: "VERIFY", title: "Verify it" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    const [message] = showToastSpy.mock.calls[0];
    expect(message).toMatch(/completed/i);
    expect(message).toMatch(/Verify it/);
  });

  it("MERGE transition uses 'completed' phrasing", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "DEPLOY" as string | null,
          title: "Ship it" as string | null,
        },
      }
    );

    rerender({ phase: "MERGE", title: "Ship it" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    const [message] = showToastSpy.mock.calls[0];
    expect(message).toMatch(/completed/i);
    expect(message).toMatch(/Ship it/);
  });

  it("when permission is granted, fires both showToast and new Notification", () => {
    const ctor = setupNotification("granted");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "PLAN" as string | null,
          title: "T" as string | null,
        },
      }
    );

    rerender({ phase: "BUILD", title: "T" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    expect(ctor).toHaveBeenCalledOnce();
  });

  it("when permission is denied, fires showToast but NOT new Notification", () => {
    const ctor = setupNotification("denied");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "PLAN" as string | null,
          title: "T" as string | null,
        },
      }
    );

    rerender({ phase: "BUILD", title: "T" });

    expect(showToastSpy).toHaveBeenCalledOnce();
    expect(ctor).not.toHaveBeenCalled();
  });

  it("registers a one-time document click listener that requests permission", async () => {
    const ctor = setupNotification("default");

    renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "PLAN" as string | null,
          title: "T" as string | null,
        },
      }
    );

    expect(ctor.requestPermission).not.toHaveBeenCalled();

    await act(async () => {
      document.dispatchEvent(new Event("click"));
    });

    expect(ctor.requestPermission).toHaveBeenCalledOnce();

    // A second click should NOT call again — listener is one-shot
    await act(async () => {
      document.dispatchEvent(new Event("click"));
    });
    expect(ctor.requestPermission).toHaveBeenCalledOnce();
  });

  it("removes click listener on unmount", () => {
    const ctor = setupNotification("default");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: "PLAN" as string | null,
          title: "T" as string | null,
        },
      }
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function));
    expect(ctor.requestPermission).not.toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it("does not fire when phase is undefined or null", () => {
    setupNotification("default");

    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null; title: string | null }) =>
        usePhaseNotifications(phase, title, 1),
      {
        wrapper: Wrapper,
        initialProps: {
          phase: null as string | null,
          title: null as string | null,
        },
      }
    );

    rerender({ phase: null, title: null });

    expect(showToastSpy).not.toHaveBeenCalled();
  });
});
