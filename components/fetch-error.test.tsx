import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FetchError } from "./fetch-error";

afterEach(() => {
  cleanup();
});

describe("FetchError", () => {
  it("renders default message", () => {
    render(<FetchError />);
    expect(screen.getByText("Failed to load data")).toBeTruthy();
  });

  it("renders custom message", () => {
    render(<FetchError message="Network error occurred" />);
    expect(screen.getByText("Network error occurred")).toBeTruthy();
  });

  it("renders retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<FetchError onRetry={onRetry} />);
    const button = screen.getByText("Retry");
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("does not render retry button when onRetry not provided", () => {
    render(<FetchError />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has red-tinted styling", () => {
    const { container } = render(<FetchError />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("red");
  });
});
