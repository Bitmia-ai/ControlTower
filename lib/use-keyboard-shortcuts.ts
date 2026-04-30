"use client";

import { useEffect, useRef } from "react";

/**
 * T052: Global keyboard shortcuts for mission-control.
 *
 * Single-key shortcuts:
 *   s -> onStart (only when !running)
 *   x -> onStop  (only when running)
 *   p -> onPause (only when running)
 *   b -> onAddTask (always)
 *
 * Two-key chords (vim-style "g" prefix, 500ms window):
 *   g b -> navigate("/project/{id}/tasks")
 *   g h -> navigate("/project/{id}/history")
 *   g l -> navigate("/project/{id}/live")
 *   g s -> navigate("/project/{id}/schedules")
 *
 * Suppression rules:
 *   - event.target is <input> or <textarea>
 *   - event.target is inside a [role="dialog"] subtree
 *   - any of metaKey / ctrlKey / altKey is held
 *   - enabled === false
 *
 * Callbacks are held in refs so stale closures never fire. The chord-window
 * timeout is cleared on unmount.
 */
export interface KeyboardShortcutConfig {
  enabled: boolean;
  running: boolean;
  projectId: number;
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onAddTask?: () => void;
  navigate?: (path: string) => void;
}

const CHORD_WINDOW_MS = 500;

export function useKeyboardShortcuts(config: KeyboardShortcutConfig): void {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let chordPending = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    function clearChord() {
      chordPending = false;
      if (chordTimer) {
        clearTimeout(chordTimer);
        chordTimer = null;
      }
    }

    function isSuppressed(ev: KeyboardEvent): boolean {
      const cfg = configRef.current;
      if (!cfg.enabled) return true;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return true;
      const target = ev.target;
      if (target instanceof HTMLInputElement) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      if (
        target instanceof HTMLElement &&
        target.closest('[role="dialog"]')
      ) {
        return true;
      }
      return false;
    }

    function handler(ev: KeyboardEvent) {
      if (isSuppressed(ev)) return;
      const cfg = configRef.current;
      const key = ev.key;

      // Chord resolution takes priority if armed.
      if (chordPending) {
        const pendingKey = key.toLowerCase();
        clearChord();
        if (!cfg.navigate) return;
        if (pendingKey === "b") {
          cfg.navigate(`/project/${cfg.projectId}/tasks`);
          return;
        }
        if (pendingKey === "h") {
          cfg.navigate(`/project/${cfg.projectId}/history`);
          return;
        }
        if (pendingKey === "l") {
          cfg.navigate(`/project/${cfg.projectId}/live`);
          return;
        }
        if (pendingKey === "s") {
          cfg.navigate(`/project/${cfg.projectId}/schedules`);
          return;
        }
        // unrecognised chord second-key: cancel silently
        return;
      }

      switch (key) {
        case "s":
          if (!cfg.running) cfg.onStart?.();
          return;
        case "x":
          if (cfg.running) cfg.onStop?.();
          return;
        case "p":
          if (cfg.running) cfg.onPause?.();
          return;
        case "b":
          cfg.onAddTask?.();
          return;
        case "g":
          chordPending = true;
          chordTimer = setTimeout(() => {
            chordPending = false;
            chordTimer = null;
          }, CHORD_WINDOW_MS);
          return;
        default:
          return;
      }
    }

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (chordTimer) clearTimeout(chordTimer);
    };
  }, []);
}
