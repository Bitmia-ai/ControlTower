import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskTransitionTracker } from "./use-task-transition-tracker";

describe("useTaskTransitionTracker", () => {
  it("first load with null active id: fires nothing", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    renderHook(({ id }: { id: string | null | undefined }) =>
      useTaskTransitionTracker(id, onStart, onSnapshot),
    { initialProps: { id: null } });

    expect(onStart).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("first load with undefined (detail not yet loaded): fires nothing", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    renderHook(({ id }: { id: string | null | undefined }) =>
      useTaskTransitionTracker(id, onStart, onSnapshot),
    { initialProps: { id: undefined } });

    expect(onStart).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("first load with a non-null active id: fires onStart for it, no snapshot", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    renderHook(({ id }: { id: string | null | undefined }) =>
      useTaskTransitionTracker(id, onStart, onSnapshot),
    { initialProps: { id: "BL-005" as string | null | undefined } });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("BL-005");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("second poll with the same id: no new POSTs", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "BL-005" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: "BL-005" });

    expect(onStart).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("X -> Y transition: fires snapshot for X then start for Y", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "BL-005" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: "BL-006" });

    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(onSnapshot).toHaveBeenCalledWith("BL-005");
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("BL-006");
  });

  it("X -> null transition: fires snapshot for X, no start", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "BL-006" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: null });

    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(onSnapshot).toHaveBeenCalledWith("BL-006");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("null -> Y transition: fires start for Y only", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: null as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: "BL-007" });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("BL-007");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("full lifecycle: undefined -> BL-005 -> BL-005 -> BL-006 -> null", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: undefined as string | null | undefined } }
    );
    // initial: undefined -> nothing
    expect(onStart).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();

    rerender({ id: "BL-005" });
    // first observation: start BL-005
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenLastCalledWith("BL-005");
    expect(onSnapshot).not.toHaveBeenCalled();

    rerender({ id: "BL-005" });
    // same -> nothing new
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSnapshot).not.toHaveBeenCalled();

    rerender({ id: "BL-006" });
    // transition -> snapshot BL-005, start BL-006
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenLastCalledWith("BL-005");
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenLastCalledWith("BL-006");

    rerender({ id: null });
    // end -> snapshot BL-006, no new start
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenLastCalledWith("BL-006");
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
