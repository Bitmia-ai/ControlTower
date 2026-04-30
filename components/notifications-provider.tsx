"use client";

/**
 * components/notifications-provider.tsx — context provider for the in-app
 * notification system (T113).
 *
 * Wraps `useNotifications` (server polling) and the localStorage-backed
 * read/unread set. Exposes `notifications`, `unreadCount`, `markAllRead`,
 * `isOpen`, `setIsOpen` to the bell, drawer, and any other consumer.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useToast } from "@/components/toast-provider";
import { useNotifications } from "@/lib/use-notifications";
import type { NotificationItem } from "@/lib/redeye-types";

const READ_STORAGE_KEY = "ct_notification_read";

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  /** Mark every currently-loaded notification as read. */
  markAllRead: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const fallback: NotificationsContextValue = {
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  isOpen: false,
  setIsOpen: () => {},
};

export function useNotificationsContext(): NotificationsContextValue {
  return useContext(NotificationsContext) ?? fallback;
}

function readStoredIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeStoredIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota exceeded etc. — ignore */
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Hydrate read set after mount (SSR-safe).
  useEffect(() => {
    setReadIds(readStoredIds());
  }, []);

  const handleNewItem = useCallback(
    (item: NotificationItem) => {
      const href = `/project/${item.projectId}`;
      try {
        showToast(item.message, href, 6000);
      } catch {
        /* never break the page */
      }
    },
    [showToast],
  );

  const { notifications } = useNotifications({ onNewItem: handleNewItem });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds],
  );

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      writeStoredIds(next);
      return next;
    });
  }, [notifications]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      markAllRead,
      isOpen,
      setIsOpen,
    }),
    [notifications, unreadCount, markAllRead, isOpen],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
