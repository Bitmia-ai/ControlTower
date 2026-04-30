import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EmptyState } from "./empty-state";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeTruthy();
  });

  it("renders subtitle when provided", () => {
    render(<EmptyState title="No items" subtitle="Add some items to get started." />);
    expect(screen.getByText("Add some items to get started.")).toBeTruthy();
  });

  it("does not render subtitle when not provided", () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByText("Add some items to get started.")).toBeNull();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="icon">X</span>} />);
    expect(screen.getByTestId("icon")).toBeTruthy();
  });

  it("renders action button and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: "Add Item", onClick }}
      />
    );
    const button = screen.getByText("Add Item");
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not render action button when not provided", () => {
    render(<EmptyState title="No items" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
