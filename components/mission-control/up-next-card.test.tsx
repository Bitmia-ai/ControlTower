import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UpNextCard } from "./up-next-card";
import type { TaskItem } from "@/lib/redeye-types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

function makeItem(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "T001",
    title: "Test item",
    status: "pending",
    section: "triaged",
    ...overrides,
  };
}

describe("UpNextCard — T088 no-pending-tasks state", () => {
  it("shows 'No pending tasks' when items list is empty", () => {
    render(<UpNextCard items={[]} />);
    expect(screen.getByText("No pending tasks")).toBeTruthy();
  });

  it("shows 'No pending tasks' when items contains only in-progress items", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T010", status: "in-progress", title: "Current task" }),
    ];
    render(<UpNextCard items={items} />);
    expect(screen.getByText("No pending tasks")).toBeTruthy();
    // The current task should NOT appear in Up Next (it belongs in WorkingOn card)
    expect(screen.queryByText("Current task")).toBeNull();
  });

  it("renders planned and pending items, excludes in-progress", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T010", status: "in-progress", title: "Current task" }),
      makeItem({ id: "T011", status: "planned", title: "Next planned" }),
      makeItem({ id: "T012", status: "pending", title: "Also pending" }),
    ];
    const { container } = render(<UpNextCard items={items} />);
    // in-progress not shown — title text appears as a sibling text node next to
    // the id span inside a single <p>, so use container.textContent inclusion
    // checks rather than getByText (which can't match split text nodes).
    expect(container.textContent).not.toContain("Current task");
    // planned and pending shown
    expect(container.textContent).toContain("Next planned");
    expect(container.textContent).toContain("Also pending");
  });

  it("slices to 3 items when more than 3 planned/pending items provided", () => {
    const items: TaskItem[] = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `T${String(i + 1).padStart(3, "0")}`, status: "planned", title: `Task ${i + 1}` })
    );
    const { container } = render(<UpNextCard items={items} />);
    // Only first 3 should appear. Titles render as sibling text nodes next to
    // the id span inside a single <p>, so use container.textContent inclusion
    // checks rather than getByText.
    expect(container.textContent).toContain("Task 1");
    expect(container.textContent).toContain("Task 2");
    expect(container.textContent).toContain("Task 3");
    expect(container.textContent).not.toContain("Task 4");
    expect(container.textContent).not.toContain("Task 5");
  });
});
