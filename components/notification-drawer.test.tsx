import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { NotificationItem } from "@/lib/redeye-types";

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

import { NotificationDrawer } from "./notification-drawer";

function build(id: string, type: NotificationItem["type"], message: string): NotificationItem {
  return {
    id,
    type,
    projectId: 0,
    projectName: "haze",
    message,
    timestamp: new Date().toISOString(),
    taskId: null,
  };
}

describe("NotificationDrawer", () => {
  beforeEach(() => {
    mockCtx.notifications = [];
    mockCtx.isOpen = false;
    mockCtx.markAllRead = vi.fn();
    mockCtx.setIsOpen = vi.fn();
  });
  afterEach(() => cleanup());

  it("renders empty-state copy when no notifications", () => {
    mockCtx.isOpen = true;
    render(<NotificationDrawer />);
    expect(screen.getByText(/no notifications yet/i)).toBeTruthy();
  });

  it("renders all three event types with their type icons / aria labels", () => {
    mockCtx.isOpen = true;
    mockCtx.notifications = [
      build("a", "task-complete", "T100 done"),
      build("b", "task-error", "Stabilizing"),
      build("c", "needs-input", "1 question"),
    ];
    render(<NotificationDrawer />);
    expect(screen.getByText("T100 done")).toBeTruthy();
    expect(screen.getByText("Stabilizing")).toBeTruthy();
    expect(screen.getByText("1 question")).toBeTruthy();
    expect(screen.getByTestId("notif-icon-task-complete")).toBeTruthy();
    expect(screen.getByTestId("notif-icon-task-error")).toBeTruthy();
    expect(screen.getByTestId("notif-icon-needs-input")).toBeTruthy();
  });

  it("calls markAllRead when drawer opens", () => {
    mockCtx.isOpen = true;
    mockCtx.notifications = [build("a", "task-complete", "x")];
    render(<NotificationDrawer />);
    expect(mockCtx.markAllRead).toHaveBeenCalledTimes(1);
  });

  it("backdrop click closes the drawer", () => {
    mockCtx.isOpen = true;
    render(<NotificationDrawer />);
    fireEvent.click(screen.getByTestId("notification-backdrop"));
    expect(mockCtx.setIsOpen).toHaveBeenCalledWith(false);
  });

  it("Mark all read button calls markAllRead", () => {
    mockCtx.isOpen = true;
    mockCtx.notifications = [build("a", "task-complete", "x")];
    render(<NotificationDrawer />);
    // First call comes from the open-effect; click should produce a 2nd call.
    const before = mockCtx.markAllRead.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));
    expect(mockCtx.markAllRead.mock.calls.length).toBeGreaterThan(before);
  });

  it("each item links to /project/<projectId>", () => {
    mockCtx.isOpen = true;
    const item = build("a", "task-complete", "msg");
    item.projectId = 7;
    mockCtx.notifications = [item];
    render(<NotificationDrawer />);
    const link = screen.getByRole("link", { name: /msg/i });
    expect(link.getAttribute("href")).toBe("/project/7");
  });

  it("limits visible items to 20", () => {
    mockCtx.isOpen = true;
    mockCtx.notifications = Array.from({ length: 25 }, (_, i) =>
      build(`id-${i}`, "task-complete", `m-${i}`),
    );
    render(<NotificationDrawer />);
    // 20 visible
    expect(screen.queryAllByTestId(/^notif-row-/).length).toBe(20);
  });

  it("does not render content when isOpen is false", () => {
    mockCtx.isOpen = false;
    mockCtx.notifications = [build("a", "task-complete", "hidden-msg")];
    render(<NotificationDrawer />);
    // Drawer should not be visible (translated off-screen / null)
    expect(screen.queryByTestId("notification-backdrop")).toBeFalsy();
  });

  it("renders the drag handle for mobile bottom sheet", () => {
    mockCtx.isOpen = true;
    render(<NotificationDrawer />);
    const dragHandle = screen.getByTestId("drawer-drag-handle");
    expect(dragHandle).toBeTruthy();
    expect(dragHandle.getAttribute("aria-hidden")).toBe("true");
  });

  it("notification drawer has bottom-sheet classes for mobile", () => {
    mockCtx.isOpen = true;
    render(<NotificationDrawer />);
    const drawer = screen.getByTestId("notification-drawer");
    // Bottom sheet: fixed to bottom, full-width on mobile
    expect(drawer.className).toContain("inset-x-0");
    expect(drawer.className).toContain("bottom-0");
    expect(drawer.className).toContain("rounded-t-2xl");
    // Right-rail on sm+
    expect(drawer.className).toContain("sm:max-w-sm");
    // overflow-hidden on the aside, scroll on inner content only
    expect(drawer.className).toContain("overflow-hidden");
  });
});
