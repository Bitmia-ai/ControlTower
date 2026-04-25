/**
 * Integration test for BL-050: phase-change toast wiring.
 * Verifies that when the mission-control polling loop reports a new phase,
 * the toast appears in the DOM via the global ToastProvider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/toast-provider";
import { usePhaseNotifications } from "@/lib/use-phase-notifications";

// Mini test page that mirrors the real wiring without all the page deps.
function TestPage({
  phase,
  title,
  projectId,
}: {
  phase: string | null | undefined;
  title: string | null;
  projectId: number;
}) {
  usePhaseNotifications(phase, title, projectId);
  return <div>page</div>;
}

describe("ProjectPage phase notifications integration", () => {
  beforeEach(() => {
    // Notification API absent — toast-only path
    // @ts-expect-error reset
    delete globalThis.Notification;
  });

  afterEach(() => {
    cleanup();
  });

  it("does not show a toast on initial render", () => {
    render(
      <ToastProvider>
        <TestPage phase="BUILD" title="X" projectId={1} />
      </ToastProvider>
    );
    expect(screen.queryByText(/RedEye entered BUILD/)).toBeFalsy();
  });

  it("shows a toast when phase transitions PLAN -> BUILD", () => {
    const { rerender } = render(
      <ToastProvider>
        <TestPage phase={"PLAN"} title="My Task" projectId={42} />
      </ToastProvider>
    );

    act(() => {
      rerender(
        <ToastProvider>
          <TestPage phase={"BUILD"} title="My Task" projectId={42} />
        </ToastProvider>
      );
    });

    expect(screen.getByText(/RedEye entered BUILD/)).toBeTruthy();
    expect(screen.getByText(/My Task/)).toBeTruthy();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/project/42/live");
  });

  it("does NOT show a toast for PLAN -> TRIAGE (low-signal)", () => {
    const { rerender } = render(
      <ToastProvider>
        <TestPage phase={"PLAN"} title="X" projectId={1} />
      </ToastProvider>
    );

    act(() => {
      rerender(
        <ToastProvider>
          <TestPage phase={"TRIAGE"} title="X" projectId={1} />
        </ToastProvider>
      );
    });

    expect(screen.queryByText(/entered TRIAGE/)).toBeFalsy();
    expect(screen.queryByText(/entered PLAN/)).toBeFalsy();
  });

  it("phase undefined -> BUILD does NOT toast (first observation only)", () => {
    const { rerender } = render(
      <ToastProvider>
        <TestPage phase={undefined} title={null} projectId={1} />
      </ToastProvider>
    );

    act(() => {
      rerender(
        <ToastProvider>
          <TestPage phase={"BUILD"} title="First" projectId={1} />
        </ToastProvider>
      );
    });

    // First observation = baseline, not a transition.
    expect(screen.queryByText(/entered BUILD/)).toBeFalsy();
  });
});
