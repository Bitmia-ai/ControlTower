import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

function fire(key: string, target?: EventTarget | null, modifiers?: Partial<KeyboardEventInit>) {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
  if (target) {
    target.dispatchEvent(ev);
  } else {
    document.dispatchEvent(ev);
  }
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Clear body using replaceChildren for safety
    document.body.replaceChildren();
  });

  it("s fires onStart when !running", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    act(() => fire("s"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("s does NOT fire onStart when running=true", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: true,
        projectId: 1,
        onStart,
      })
    );
    act(() => fire("s"));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("x fires onStop when running=true", () => {
    const onStop = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: true,
        projectId: 1,
        onStop,
      })
    );
    act(() => fire("x"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("x does NOT fire onStop when running=false", () => {
    const onStop = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStop,
      })
    );
    act(() => fire("x"));
    expect(onStop).not.toHaveBeenCalled();
  });

  it("p fires onPause when running=true, not when idle", () => {
    const onPause = vi.fn();
    const { rerender } = renderHook(
      ({ running }: { running: boolean }) =>
        useKeyboardShortcuts({
          enabled: true,
          running,
          projectId: 1,
          onPause,
        }),
      { initialProps: { running: false } }
    );
    act(() => fire("p"));
    expect(onPause).not.toHaveBeenCalled();

    rerender({ running: true });
    act(() => fire("p"));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("b fires onAddBacklog regardless of running", () => {
    const onAddBacklog = vi.fn();
    const { rerender } = renderHook(
      ({ running }: { running: boolean }) =>
        useKeyboardShortcuts({
          enabled: true,
          running,
          projectId: 1,
          onAddBacklog,
        }),
      { initialProps: { running: false } }
    );
    act(() => fire("b"));
    expect(onAddBacklog).toHaveBeenCalledTimes(1);

    rerender({ running: true });
    act(() => fire("b"));
    expect(onAddBacklog).toHaveBeenCalledTimes(2);
  });

  it("g+b navigates to backlog path", () => {
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 42,
        navigate,
      })
    );
    act(() => fire("g"));
    act(() => fire("b"));
    expect(navigate).toHaveBeenCalledWith("/project/42/backlog");
  });

  it("g+h navigates to history path", () => {
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 7,
        navigate,
      })
    );
    act(() => fire("g"));
    act(() => fire("h"));
    expect(navigate).toHaveBeenCalledWith("/project/7/history");
  });

  it("g+l navigates to live path", () => {
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 9,
        navigate,
      })
    );
    act(() => fire("g"));
    act(() => fire("l"));
    expect(navigate).toHaveBeenCalledWith("/project/9/live");
  });

  it("g+s navigates to schedules path", () => {
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 5,
        navigate,
      })
    );
    act(() => fire("g"));
    act(() => fire("s"));
    expect(navigate).toHaveBeenCalledWith("/project/5/schedules");
  });

  it("g alone does NOT call navigate after 500ms timeout", () => {
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        navigate,
      })
    );
    act(() => fire("g"));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => fire("b"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("g+unrecognised key cancels chord silently", () => {
    const navigate = vi.fn();
    const onAddBacklog = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        navigate,
        onAddBacklog,
      })
    );
    act(() => fire("g"));
    act(() => fire("z"));
    expect(navigate).not.toHaveBeenCalled();
    act(() => fire("b"));
    expect(onAddBacklog).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("suppresses shortcuts when event.target is an <input>", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => fire("s", input));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("suppresses shortcuts when event.target is inside a [role='dialog']", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const btn = document.createElement("button");
    dialog.appendChild(btn);
    document.body.appendChild(dialog);
    act(() => fire("s", btn));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("suppresses shortcuts when metaKey is held", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    act(() => fire("s", null, { metaKey: true }));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("suppresses shortcuts when ctrlKey is held", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    act(() => fire("s", null, { ctrlKey: true }));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("suppresses shortcuts when altKey is held", () => {
    const onStart = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    act(() => fire("s", null, { altKey: true }));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("enabled=false suppresses all shortcuts", () => {
    const onStart = vi.fn();
    const onAddBacklog = vi.fn();
    const navigate = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: false,
        running: false,
        projectId: 1,
        onStart,
        onAddBacklog,
        navigate,
      })
    );
    act(() => fire("s"));
    act(() => fire("b"));
    act(() => fire("g"));
    act(() => fire("b"));
    expect(onStart).not.toHaveBeenCalled();
    expect(onAddBacklog).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reads callbacks from refs — only latest callback fires after rerender", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useKeyboardShortcuts({
          enabled: true,
          running: false,
          projectId: 1,
          onStart: cb,
        }),
      { initialProps: { cb: first } }
    );
    rerender({ cb: second });
    act(() => fire("s"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("clears chord timeout on unmount (no dangling timers)", () => {
    const navigate = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        navigate,
      })
    );
    act(() => fire("g"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("removes listener on unmount", () => {
    const onStart = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
        running: false,
        projectId: 1,
        onStart,
      })
    );
    unmount();
    act(() => fire("s"));
    expect(onStart).not.toHaveBeenCalled();
  });
});
