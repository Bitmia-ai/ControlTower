import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ControlsCard } from "./controls-card";

describe("ControlsCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("swaps Stop label to Stopping… and disables button for 3s on click", async () => {
    const onStop = vi.fn();
    render(<ControlsCard running={true} onStop={onStop} />);

    const btn = screen.getByRole("button", { name: /^Stop$/ });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(onStop).toHaveBeenCalled();
    const stopping = screen.getByRole("button", { name: /^Stopping/ }) as HTMLButtonElement;
    expect(stopping.disabled).toBe(true);
    expect(screen.getByText(/Directive sent/i)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    const revertedStop = screen.getByRole("button", { name: /^Stop$/ }) as HTMLButtonElement;
    expect(revertedStop.disabled).toBe(false);
  });

  it("swaps Pause label to Pausing… and disables button for 3s on click", async () => {
    const onPause = vi.fn();
    render(<ControlsCard running={true} onPause={onPause} />);

    const btn = screen.getByRole("button", { name: /^Pause$/ });
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(onPause).toHaveBeenCalled();
    const pausing = screen.getByRole("button", { name: /Pausing/ }) as HTMLButtonElement;
    expect(pausing.disabled).toBe(true);
    expect(screen.getByText(/Directive sent/i)).toBeTruthy();
  });

  it("renders chevron dropdown button when running and no standalone Force Stop row", () => {
    render(<ControlsCard running={true} />);
    expect(
      screen.getByRole("button", { name: /more stop options/i })
    ).toBeTruthy();
    // Dropdown is closed initially — Force Stop option is not visible
    expect(screen.queryByRole("menuitem", { name: /Force Stop/ })).toBeNull();
  });

  it("does NOT render chevron dropdown when not running", () => {
    render(<ControlsCard running={false} />);
    expect(
      screen.queryByRole("button", { name: /more stop options/i })
    ).toBeNull();
  });

  it("opens dropdown on chevron click and shows Force Stop option", async () => {
    render(<ControlsCard running={true} />);
    const chevron = screen.getByRole("button", { name: /more stop options/i });
    await act(async () => {
      fireEvent.click(chevron);
    });
    expect(
      screen.getByRole("menuitem", { name: /^Force Stop$/ })
    ).toBeTruthy();
  });

  it("first click on Force Stop shows confirmation and does NOT call onForceStop", async () => {
    const onForceStop = vi.fn();
    render(<ControlsCard running={true} onForceStop={onForceStop} />);

    const chevron = screen.getByRole("button", { name: /more stop options/i });
    await act(async () => {
      fireEvent.click(chevron);
    });
    const forceStopItem = screen.getByRole("menuitem", {
      name: /^Force Stop$/,
    });
    await act(async () => {
      fireEvent.click(forceStopItem);
    });

    expect(onForceStop).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menuitem", { name: /Confirm hard kill/i })
    ).toBeTruthy();
  });

  it("second click on confirmation executes force stop", async () => {
    const onForceStop = vi.fn();
    render(<ControlsCard running={true} onForceStop={onForceStop} />);

    const chevron = screen.getByRole("button", { name: /more stop options/i });
    await act(async () => {
      fireEvent.click(chevron);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /^Force Stop$/ }));
    });
    const confirm = screen.getByRole("menuitem", {
      name: /Confirm hard kill/i,
    });
    await act(async () => {
      fireEvent.click(confirm);
    });

    expect(onForceStop).toHaveBeenCalledTimes(1);
    // Dropdown should be closed after confirmation
    expect(screen.queryByRole("menuitem")).toBeNull();
    // Stop button now reflects force-stopping state
    expect(
      screen.getByRole("button", { name: /Force Stopping/ })
    ).toBeTruthy();
  });

  it("confirmation auto-dismisses after 4s", async () => {
    const onForceStop = vi.fn();
    render(<ControlsCard running={true} onForceStop={onForceStop} />);

    const chevron = screen.getByRole("button", { name: /more stop options/i });
    await act(async () => {
      fireEvent.click(chevron);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: /^Force Stop$/ }));
    });
    expect(
      screen.getByRole("menuitem", { name: /Confirm hard kill/i })
    ).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(4100);
    });

    expect(
      screen.queryByRole("menuitem", { name: /Confirm hard kill/i })
    ).toBeNull();
    // Default "Force Stop" label should be back (dropdown still open)
    expect(
      screen.getByRole("menuitem", { name: /^Force Stop$/ })
    ).toBeTruthy();
    expect(onForceStop).not.toHaveBeenCalled();
  });

  it("Escape closes dropdown", async () => {
    render(<ControlsCard running={true} />);
    const chevron = screen.getByRole("button", { name: /more stop options/i });
    await act(async () => {
      fireEvent.click(chevron);
    });
    expect(
      screen.getByRole("menuitem", { name: /^Force Stop$/ })
    ).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("clicking main Stop button still fires onStop", async () => {
    const onStop = vi.fn();
    render(<ControlsCard running={true} onStop={onStop} />);

    const stopBtn = screen.getByRole("button", { name: /^Stop$/ });
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("renders Add Task button with correct accessible label and fires click handler", async () => {
    const onAddBacklog = vi.fn();
    render(<ControlsCard running={false} onAddBacklog={onAddBacklog} />);

    const btn = screen.getByRole("button", { name: /Add task/i });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("Add Task");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(onAddBacklog).toHaveBeenCalledTimes(1);
  });

  it("T067 — uses p-4 (compact rail padding)", () => {
    const { container } = render(<ControlsCard running={true} />);
    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.className).toContain("p-4");
    expect(card?.className).not.toContain("p-5");
  });

  it("T067 — renders separator border-t between stop/pause and steer/backlog rows", () => {
    const { container } = render(<ControlsCard running={true} />);
    // Steer/Add-Task row gains border-t separator
    const steerBtn = screen.getByRole("button", { name: /^Steer$/ });
    const row = steerBtn.parentElement as HTMLElement | null;
    expect(row?.className).toContain("border-t");
    expect(row?.className).toContain("pt-3");
  });

  it("caption auto-hides after 5s", async () => {
    const onStop = vi.fn();
    render(<ControlsCard running={true} onStop={onStop} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Stop$/ }));
    });
    expect(screen.getByText(/Directive sent/i)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.queryByText(/Directive sent/i)).toBeNull();
  });
});
