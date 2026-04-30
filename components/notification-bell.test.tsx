import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { NotificationItem } from "@/lib/redeye-types";

// Allow each test to control the context it provides.
const mockCtx = {
  notifications: [] as NotificationItem[],
  unreadCount: 0,
  markAllRead: vi.fn(),
  isOpen: false,
  setIsOpen: vi.fn(),
};

vi.mock("@/components/notifications-provider", () => ({
  useNotificationsContext: () => mockCtx,
}));

import { NotificationBell } from "./notification-bell";

describe("NotificationBell", () => {
  beforeEach(() => {
    mockCtx.notifications = [];
    mockCtx.unreadCount = 0;
    mockCtx.isOpen = false;
    mockCtx.markAllRead = vi.fn();
    mockCtx.setIsOpen = vi.fn();
  });
  afterEach(() => cleanup());

  it("hides badge when unreadCount is 0", () => {
    render(<NotificationBell />);
    expect(screen.queryByTestId("notification-badge")).toBeFalsy();
  });

  it("shows badge with count when unreadCount > 0", () => {
    mockCtx.unreadCount = 3;
    render(<NotificationBell />);
    const badge = screen.getByTestId("notification-badge");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("3");
  });

  it("calls setIsOpen(true) on click", () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByTestId("notification-bell"));
    expect(mockCtx.setIsOpen).toHaveBeenCalledWith(true);
  });

  it("aria-label reflects current unread count", () => {
    mockCtx.unreadCount = 2;
    render(<NotificationBell />);
    expect(
      screen.getByLabelText(/Notifications.*2 unread/i),
    ).toBeTruthy();
  });

  it("aria-label is plural-safe at 0", () => {
    render(<NotificationBell />);
    expect(screen.getByLabelText(/Notifications.*0 unread/i)).toBeTruthy();
  });

  it("badge caps at 99+", () => {
    mockCtx.unreadCount = 150;
    render(<NotificationBell />);
    expect(screen.getByTestId("notification-badge").textContent).toBe("99+");
  });
});
