"use client";

/**
 * lib/use-notifications.ts — client polling hook for the in-app notification
 * system (T113).
 *
 *   - Polls GET /api/notifications every 5s (5000 ms) using the layout-poll
 *     cadence defined elsewhere in the app.
 *   - On mount: fetches all buffered events (no `since`) so the drawer is
 *     populated immediately, but does NOT fire toasts for those events.
 *   - Initialises `sinceRef` to `Date.now()` on mount so subsequent polls
 *     only consider events created after the page loaded.
 *   - Visibility-aware: stops polling when the tab goes hidden, immediately
 *     refetches and resumes on visible.
 *
 * Read/unread state is owned by `notifications-provider.tsx` — this hook
 * deals only with the server-side event stream.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "./redeye-types";

const POLL_INTERVAL_MS = 5000;

interface UseNotificationsResult {
  notifications: NotificationItem[];
  /** Fired exactly once per newly-seen-after-mount event. Drawer-only events do not invoke this. */
  // (no callback returned — toast firing is wired inline)
}

interface UseNotificationsOptions {
  onNewItem?: (item: NotificationItem) => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {},
): { notifications: NotificationItem[] } {
  const { onNewItem } = options;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // sinceRef: epoch ms. 0 on first call → fetch all buffered.
  const sinceRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(false);
  const onNewItemRef = useRef<typeof onNewItem>(onNewItem);
  onNewItemRef.current = onNewItem;

  const tick = useCallback(async () => {
    const since = sinceRef.current;
    const url = since > 0 ? `/api/notifications?since=${since}` : `/api/notifications`;
    let json: { data?: { notifications?: NotificationItem[] }; error?: string };
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      json = await res.json();
    } catch {
      return;
    }
    const items = json.data?.notifications ?? [];
    if (items.length === 0) {
      // First poll always advances `since` to "now" so the next tick is incremental.
      if (sinceRef.current === 0) sinceRef.current = Date.now();
      return;
    }

    if (!mountedRef.current) {
      // Initial load — populate drawer, do NOT fire toasts.
      setNotifications((prev) => mergeUnique(prev, items));
      mountedRef.current = true;
      sinceRef.current = Date.now();
      return;
    }

    // Subsequent ticks — fire onNewItem for each new event.
    setNotifications((prev) => mergeUnique(prev, items));
    for (const item of items) {
      try {
        onNewItemRef.current?.(item);
      } catch {
        /* never break the page */
      }
    }
    const maxTs = items.reduce(
      (acc, n) => Math.max(acc, new Date(n.timestamp).getTime()),
      sinceRef.current,
    );
    sinceRef.current = Math.max(sinceRef.current, maxTs);
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void tick();
        start();
      }
    };

    // Initial fetch
    void tick();
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tick]);

  return { notifications };
}

function mergeUnique(prev: NotificationItem[], next: NotificationItem[]): NotificationItem[] {
  const seen = new Set(prev.map((n) => n.id));
  const merged = [...prev];
  for (const n of next) {
    if (!seen.has(n.id)) {
      merged.push(n);
      seen.add(n.id);
    }
  }
  // Newest first.
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged;
}

export type { UseNotificationsResult };
