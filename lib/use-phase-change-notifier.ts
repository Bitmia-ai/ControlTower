"use client";

import { useEffect, useRef } from "react";

/**
 * Detects RedEye phase transitions across renders and fires `onPhaseChange`
 * for genuine transitions only.
 *
 * Semantics (BL-050):
 *   - First observation (previous is `undefined`): record baseline. Do NOT fire.
 *     This prevents false-positive notifications when the user opens the page.
 *   - Same phase on re-render: nothing fires.
 *   - X -> Y where Y is non-null and X !== Y: fires `onPhaseChange(Y, backlogTitle)`.
 *   - X -> null/undefined: nothing fires (no notification for "no phase").
 *
 * Mirrors the `useTaskTransitionTracker` pattern. Callback is held in a ref
 * so re-renders that change the callback identity do not re-run the effect.
 */
export function usePhaseChangeNotifier(
  phase: string | null | undefined,
  backlogTitle: string | null,
  onPhaseChange: (newPhase: string, backlogTitle: string | null) => void
) {
  const prevRef = useRef<string | null | undefined>(undefined);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  // Keep latest title in a ref so the effect dep array stays narrow.
  const titleRef = useRef(backlogTitle);
  titleRef.current = backlogTitle;

  useEffect(() => {
    // Skip until we have first observed a defined phase.
    if (phase === undefined) return;

    const prev = prevRef.current;
    const next: string | null = phase;

    if (prev === undefined) {
      // First observation — record baseline, do not fire.
      prevRef.current = next;
      return;
    }

    if (prev !== next && next !== null) {
      onPhaseChangeRef.current(next, titleRef.current);
    }

    prevRef.current = next;
  }, [phase]);
}
