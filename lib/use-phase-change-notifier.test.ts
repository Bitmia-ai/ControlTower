import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePhaseChangeNotifier } from "./use-phase-change-notifier";

describe("usePhaseChangeNotifier", () => {
  it("first render with a phase: does NOT fire callback (first-mount guard)", () => {
    const onPhaseChange = vi.fn();
    renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, "Build it", onPhaseChange),
      { initialProps: { phase: "BUILD" } }
    );

    expect(onPhaseChange).not.toHaveBeenCalled();
  });

  it("first render with undefined: does NOT fire callback", () => {
    const onPhaseChange = vi.fn();
    renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, null, onPhaseChange),
      { initialProps: { phase: undefined } }
    );

    expect(onPhaseChange).not.toHaveBeenCalled();
  });

  it("same phase across re-renders: does NOT fire callback", () => {
    const onPhaseChange = vi.fn();
    const { rerender } = renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, "Working", onPhaseChange),
      { initialProps: { phase: "BUILD" as string | null | undefined } }
    );

    rerender({ phase: "BUILD" });
    rerender({ phase: "BUILD" });

    expect(onPhaseChange).not.toHaveBeenCalled();
  });

  it("transition PLAN -> BUILD: fires callback with new phase and title", () => {
    const onPhaseChange = vi.fn();
    const { rerender } = renderHook(
      ({ phase, title }: { phase: string | null | undefined; title: string | null }) =>
        usePhaseChangeNotifier(phase, title, onPhaseChange),
      { initialProps: { phase: "PLAN" as string | null | undefined, title: "Spec it" as string | null } }
    );

    rerender({ phase: "BUILD", title: "Build it" });

    expect(onPhaseChange).toHaveBeenCalledOnce();
    expect(onPhaseChange).toHaveBeenCalledWith("BUILD", "Build it");
  });

  it("transition undefined -> BUILD then BUILD -> REVIEW: only the second fires", () => {
    const onPhaseChange = vi.fn();
    const { rerender } = renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, "Task", onPhaseChange),
      { initialProps: { phase: undefined as string | null | undefined } }
    );

    rerender({ phase: "BUILD" });
    expect(onPhaseChange).not.toHaveBeenCalled();

    rerender({ phase: "REVIEW" });
    expect(onPhaseChange).toHaveBeenCalledOnce();
    expect(onPhaseChange).toHaveBeenLastCalledWith("REVIEW", "Task");
  });

  it("transition does not double-fire when re-rendered after firing", () => {
    const onPhaseChange = vi.fn();
    const { rerender } = renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, null, onPhaseChange),
      { initialProps: { phase: "PLAN" as string | null | undefined } }
    );

    rerender({ phase: "BUILD" });
    expect(onPhaseChange).toHaveBeenCalledTimes(1);

    rerender({ phase: "BUILD" });
    expect(onPhaseChange).toHaveBeenCalledTimes(1);
  });

  it("uses the latest callback reference on each transition (no stale closure)", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(
      ({ phase, cb }: { phase: string | null | undefined; cb: (p: string, t: string | null) => void }) =>
        usePhaseChangeNotifier(phase, "T", cb),
      { initialProps: { phase: "PLAN" as string | null | undefined, cb: cb1 } }
    );

    // Swap callback before transition
    rerender({ phase: "PLAN", cb: cb2 });
    rerender({ phase: "BUILD", cb: cb2 });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledWith("BUILD", "T");
  });

  it("ignores transitions when new phase is null/undefined", () => {
    const onPhaseChange = vi.fn();
    const { rerender } = renderHook(
      ({ phase }: { phase: string | null | undefined }) =>
        usePhaseChangeNotifier(phase, null, onPhaseChange),
      { initialProps: { phase: "BUILD" as string | null | undefined } }
    );

    rerender({ phase: null });
    rerender({ phase: undefined });

    expect(onPhaseChange).not.toHaveBeenCalled();
  });
});
