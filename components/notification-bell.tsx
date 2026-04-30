"use client";

/**
 * components/notification-bell.tsx — header bell-icon button with unread badge.
 * Click opens the notification drawer (state owned by NotificationsProvider).
 */

import { Bell } from "lucide-react";
import { useNotificationsContext } from "@/components/notifications-provider";

export function NotificationBell() {
  const { unreadCount, setIsOpen } = useNotificationsContext();
  const display = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      type="button"
      data-testid="notification-bell"
      aria-label={`Notifications — ${unreadCount} unread`}
      onClick={() => setIsOpen(true)}
      className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          data-testid="notification-badge"
          className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none px-1.5 py-0.5 min-w-[18px] h-[18px]"
        >
          {display}
        </span>
      )}
    </button>
  );
}
