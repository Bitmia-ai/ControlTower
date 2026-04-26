"use client";

import { useEffect, useRef } from "react";

/**
 * Tracks the active task ID across renders and fires side-effect
 * callbacks when it transitions.
 *
 * Semantics (T046):
 *   - First observation (previous is `undefined`): if the new id is non-null,
 *     fire `onStart(newId)` to record a baseline for the already-running task.
 *     No snapshot fires on first observation.
 *   - Same id twice in a row: nothing fires.
 *   - X -> Y (both non-null, X !== Y): fires `onSnapshot(X)` AND `onStart(Y)`.
 *   - X -> null: fires `onSnapshot(X)` only.
 *   - null -> Y: fires `onStart(Y)` only.
 *
 * Callbacks are fire-and-forget — errors inside them must not bubble up
 * and block the render. The caller is responsible for promise handling.
 */
export function useTaskTransitionTracker(
  activeId: string | null | undefined,
  onStart: (blId: string) => void,
  onSnapshot: (blId: string) => void
) {
  const prevRef = useRef<string | null | undefined>(undefined);
  // Hold the latest callbacks in refs so the effect only re-runs when activeId
  // changes, not when the parent recreates the callback functions.
  const onStartRef = useRef(onStart);
  const onSnapshotRef = useRef(onSnapshot);
  onStartRef.current = onStart;
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    // Normalise `undefined` (detail not yet loaded) to the sentinel — we only
    // want to evaluate transitions once we have observed at least one state.
    if (activeId === undefined) return;

    const newActiveId: string | null = activeId;
    const prevActiveId = prevRef.current;

    if (prevActiveId === undefined) {
      // First observation — record baseline for whatever is already active.
      if (newActiveId !== null) {
        onStartRef.current(newActiveId);
      }
    } else if (prevActiveId !== newActiveId) {
      // A genuine transition. Order: snapshot the outgoing task first, then
      // start the incoming one, so they are never conflated server-side.
      if (prevActiveId !== null) {
        onSnapshotRef.current(prevActiveId);
      }
      if (newActiveId !== null) {
        onStartRef.current(newActiveId);
      }
    }

    prevRef.current = newActiveId;
  }, [activeId]); // only activeId — callbacks are read from refs
}
