"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { Icon } from "./icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { useNotificationsContext } from "@/components/notifications-provider";

export function TopBar() {
  const { unreadCount, setIsOpen } = useNotificationsContext();

  return (
    <header
      className="flex items-center justify-between sticky top-0 z-10"
      style={{
        padding: "14px 28px",
        borderBottom: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}
    >
      <Link
        href="/"
        aria-label="Control Tower — go to home"
        className="flex items-center gap-3 select-none"
      >
        <span style={{ color: "var(--fg-0)", display: "flex", margin: "-12px 0" }}>
          <Logo size={48} />
        </span>
        <span className="flex flex-col" style={{ lineHeight: 1.05 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--fg-0)",
              letterSpacing: "-0.01em",
            }}
          >
            Control Tower
          </span>
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "var(--red)",
              fontWeight: 500,
            }}
          >
            on RedEye
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-1.5">
        <Link
          href="/activity"
          className="btn ghost icon-only"
          aria-label="Activity"
          title="Activity"
        >
          <Icon name="activity" size={16} />
        </Link>
        <button
          type="button"
          data-testid="notification-bell"
          className="btn ghost icon-only relative"
          aria-label={`Notifications — ${unreadCount} unread`}
          title="Notifications"
          onClick={() => setIsOpen(true)}
        >
          <Icon name="bell" size={16} />
          {unreadCount > 0 && (
            <span
              data-testid="notification-badge"
              aria-hidden
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--red)",
                border: "2px solid var(--bg-0)",
              }}
            />
          )}
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
