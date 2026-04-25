import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast-provider";

function Trigger({ message, href, duration }: { message: string; href?: string; duration?: number }) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast(message, href, duration)}>fire</button>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders children and shows toast when showToast is called", () => {
    render(
      <ToastProvider>
        <Trigger message="hello toast" />
      </ToastProvider>
    );

    expect(screen.queryByText("hello toast")).not.toBeTruthy();

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
    });

    expect(screen.getByText("hello toast")).toBeTruthy();
  });

  it("auto-dismisses after default 5000ms duration", () => {
    render(
      <ToastProvider>
        <Trigger message="auto dismiss" />
      </ToastProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
    });
    expect(screen.getByText("auto dismiss")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.queryByText("auto dismiss")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("auto dismiss")).toBeFalsy();
  });

  it("respects custom duration", () => {
    render(
      <ToastProvider>
        <Trigger message="quick" duration={1000} />
      </ToastProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
    });
    expect(screen.getByText("quick")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("quick")).toBeFalsy();
  });

  it("dismiss button removes toast immediately", () => {
    render(
      <ToastProvider>
        <Trigger message="dismiss me" />
      </ToastProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
    });
    expect(screen.getByText("dismiss me")).toBeTruthy();

    const closeBtn = screen.getByRole("button", { name: /dismiss notification/i });
    act(() => {
      closeBtn.click();
    });

    expect(screen.queryByText("dismiss me")).toBeFalsy();
  });

  it("renders link when href is provided", () => {
    render(
      <ToastProvider>
        <Trigger message="go somewhere" href="/project/1/live" />
      </ToastProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
    });

    const link = screen.getByRole("link", { name: /go somewhere/ });
    expect(link.getAttribute("href")).toBe("/project/1/live");
  });

  it("supports multiple concurrent toasts", () => {
    render(
      <ToastProvider>
        <Trigger message="first" />
      </ToastProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "fire" }).click();
      screen.getByRole("button", { name: "fire" }).click();
    });

    expect(screen.getAllByText("first").length).toBe(2);
  });

  it("throws if useToast is called outside ToastProvider", () => {
    function Outside() {
      useToast();
      return null;
    }
    // suppress React error log
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Outside />)).toThrow();
    spy.mockRestore();
  });
});
