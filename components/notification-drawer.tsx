"use client";

/**
 * components/notification-drawer.tsx — notification panel that adapts to
 * viewport size. On mobile (< sm breakpoint) it appears as a bottom sheet
 * (rounded top, drag handle, 80vh max). On sm+ it is a right-side panel.
 * Backdrop-click and Esc close it. Marks everything as read on open.
 */

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { useNotificationsContext } from "@/components/notifications-provider";
import type { NotificationItem, NotificationType } from "@/lib/redeye-types";

const VISIBLE_LIMIT = 20;

function TypeIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "task-complete":
      return (
        <CheckCircle
          data-testid="notif-icon-task-complete"
          className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0"
          aria-hidden="true"
        />
      );
    case "task-error":
      return (
        <AlertTriangle
          data-testid="notif-icon-task-error"
          className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0"
          aria-hidden="true"
        />
      );
    case "needs-input":
      return (
        <HelpCircle
          data-testid="notif-icon-needs-input"
          className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0"
          aria-hidden="true"
        />
      );
  }
}

function relativeFromNow(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} day${diffD > 1 ? "s" : ""} ago`;
}

function Row({ item }: { item: NotificationItem }) {
  return (
    <Link
      href={`/project/${item.projectId}`}
      data-testid={`notif-row-${item.id}`}
      className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
    >
      <TypeIcon type={item.type} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 dark:text-zinc-400 truncate">
          {item.projectName}
        </div>
        <div className="text-sm text-gray-900 dark:text-zinc-100 break-words">
          {item.message}
        </div>
        <div className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
          {relativeFromNow(item.timestamp)}
        </div>
      </div>
    </Link>
  );
}

export function NotificationDrawer() {
  const { notifications, isOpen, setIsOpen, markAllRead } = useNotificationsContext();

  // Mark everything read on open. Effect runs only when `isOpen` flips to true.
  useEffect(() => {
    if (isOpen) markAllRead();
  }, [isOpen, markAllRead]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const visible = notifications.slice(0, VISIBLE_LIMIT);

  return (
    <>
      <div
        data-testid="notification-backdrop"
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden="true"
      />
      <aside
        data-testid="notification-drawer"
        role="dialog"
        aria-label="Notifications"
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-auto sm:h-full w-full sm:max-w-sm max-h-[80vh] sm:max-h-full rounded-t-2xl sm:rounded-none bg-white dark:bg-zinc-900 border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-zinc-800 shadow-xl flex flex-col overflow-hidden"
      >
        {/* Drag handle — mobile only */}
        <div
          className="sm:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-600 shrink-0"
          aria-hidden="true"
          data-testid="drawer-drag-handle"
        />
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
            Notifications
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => markAllRead()}
              className="text-xs text-gray-600 dark:text-zinc-300 hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
              className="text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-lg leading-none px-2"
            >
              ×
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-zinc-400 text-center">
              No notifications yet.
            </div>
          ) : (
            visible.map((item) => <Row key={item.id} item={item} />)
          )}
        </div>
      </aside>
    </>
  );
}
