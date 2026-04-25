"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { usePhaseChangeNotifier } from "./use-phase-change-notifier";

/**
 * Phases that should trigger a user-visible notification on transition.
 * Intermediate / low-signal phases are deliberately excluded.
 */
export const NOTIFIABLE_PHASES: ReadonlySet<string> = new Set([
  "BUILD",
  "REVIEW",
  "DEPLOY",
  "MERGE",
  "STABILIZE",
]);

function composeMessage(phase: string, backlogTitle: string | null): string {
  const titleSuffix = backlogTitle ? ` — ${backlogTitle}` : "";
  switch (phase) {
    case "BUILD":
      return `RedEye entered BUILD phase${titleSuffix}`;
    case "REVIEW":
      return `RedEye entered REVIEW phase${titleSuffix}`;
    case "DEPLOY":
      return `RedEye entered DEPLOY phase${titleSuffix}`;
    case "MERGE":
      return `RedEye completed${backlogTitle ? ` ${backlogTitle}` : " current task"}`;
    case "STABILIZE":
      return `RedEye entered STABILIZE — environment broken${titleSuffix}`;
    default:
      return `RedEye entered ${phase} phase${titleSuffix}`;
  }
}

interface PhaseNotificationsApi {
  notificationsEnabled: boolean;
  requestPermission: () => Promise<NotificationPermission | null>;
}

/**
 * Wires phase-change detection (via `usePhaseChangeNotifier`) to two output
 * channels:
 *   1. In-app toast (always, via `ToastProvider` context).
 *   2. Native `Notification` (only if permission is `"granted"`).
 *
 * Also registers a one-time `document` click listener to request notification
 * permission on first user interaction (browsers require a user gesture).
 *
 * Filters phases via `NOTIFIABLE_PHASES` — TRIAGE, PLAN, HARDEN etc. are
 * intentionally low-signal and never raise a notification.
 */
export function usePhaseNotifications(
  phase: string | null | undefined,
  backlogTitle: string | null,
  projectId: number
): PhaseNotificationsApi {
  const { showToast } = useToast();

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      const N = (globalThis as { Notification?: { permission: NotificationPermission } }).Notification;
      return N?.permission === "granted";
    }
  );

  const requestPermission = useCallback(async (): Promise<
    NotificationPermission | null
  > => {
    if (typeof window === "undefined") return null;
    const N = (globalThis as { Notification?: {
      permission: NotificationPermission;
      requestPermission?: () => Promise<NotificationPermission>;
    } }).Notification;
    if (!N || typeof N.requestPermission !== "function") return null;
    if (N.permission === "granted" || N.permission === "denied") {
      setNotificationsEnabled(N.permission === "granted");
      return N.permission;
    }
    try {
      const result = await N.requestPermission();
      setNotificationsEnabled(result === "granted");
      return result;
    } catch {
      return null;
    }
  }, []);

  // One-time document click listener — fires permission request on first
  // user gesture, then removes itself. Cleans up on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const N = (globalThis as { Notification?: { permission: NotificationPermission } }).Notification;
    if (!N) return;
    // Already decided — no need for a one-shot listener.
    if (N.permission === "granted" || N.permission === "denied") return;

    const handler = () => {
      document.removeEventListener("click", handler);
      void requestPermission();
    };
    document.addEventListener("click", handler);
    return () => {
      document.removeEventListener("click", handler);
    };
  }, [requestPermission]);

  // Phase-change handler. Held by reference inside the notifier hook so the
  // closure captures the latest `projectId`/`showToast` automatically.
  const handlePhaseChange = useCallback(
    (newPhase: string, title: string | null) => {
      if (!NOTIFIABLE_PHASES.has(newPhase)) return;

      const message = composeMessage(newPhase, title);
      const href = `/project/${projectId}/live`;

      try {
        showToast(message, href);
      } catch {
        // toast layer must never break the page
      }

      const N = (globalThis as { Notification?: new (
        title: string,
        options?: { body?: string }
      ) => unknown; } & {
        Notification?: { permission: NotificationPermission };
      }).Notification;
      if (
        N &&
        (globalThis as { Notification?: { permission: NotificationPermission } })
          .Notification?.permission === "granted"
      ) {
        try {
          new (N as new (t: string, o?: { body?: string }) => unknown)(
            "Control Tower",
            { body: message }
          );
        } catch {
          // some browsers throw on Notification ctor outside SW context
        }
      }
    },
    [projectId, showToast]
  );

  usePhaseChangeNotifier(phase, backlogTitle, handlePhaseChange);

  return { notificationsEnabled, requestPermission };
}
