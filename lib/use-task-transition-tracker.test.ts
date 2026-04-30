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
    { initialProps: { id: "T005" as string | null | undefined } });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("T005");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("second poll with the same id: no new POSTs", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "T005" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: "T005" });

    expect(onStart).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("X -> Y transition: fires snapshot for X then start for Y", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "T005" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: "T006" });

    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(onSnapshot).toHaveBeenCalledWith("T005");
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("T006");
  });

  it("X -> null transition: fires snapshot for X, no start", () => {
    const onStart = vi.fn();
    const onSnapshot = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string | null | undefined }) =>
        useTaskTransitionTracker(id, onStart, onSnapshot),
      { initialProps: { id: "T006" as string | null | undefined } }
    );
    onStart.mockClear();
    onSnapshot.mockClear();

    rerender({ id: null });

    expect(onSnapshot).toHaveBeenCalledOnce();
    expect(onSnapshot).toHaveBeenCalledWith("T006");
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

    rerender({ id: "T007" });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("T007");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("full lifecycle: undefined -> T005 -> T005 -> T006 -> null", () => {
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

    rerender({ id: "T005" });
    // first observation: start T005
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenLastCalledWith("T005");
    expect(onSnapshot).not.toHaveBeenCalled();

    rerender({ id: "T005" });
    // same -> nothing new
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSnapshot).not.toHaveBeenCalled();

    rerender({ id: "T006" });
    // transition -> snapshot T005, start T006
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenLastCalledWith("T005");
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenLastCalledWith("T006");

    rerender({ id: null });
    // end -> snapshot T006, no new start
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenLastCalledWith("T006");
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
