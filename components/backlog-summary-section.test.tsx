import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BacklogSummarySection } from "./backlog-summary-section";

afterEach(() => {
  cleanup();
});

const SHORT = "All set: ten cards rendered.";
const LONG =
  "User message boxes in the Live tab transcript are now collapsible and collapsed by default, reducing visual noise. A sticky Collapse All / Expand All toolbar was added to let users toggle all boxes at once without losing their scroll position.";

describe("BacklogSummarySection — render gate", () => {
  it("renders nothing when summary is empty string", () => {
    const { container } = render(<BacklogSummarySection summary="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when summary is whitespace-only", () => {
    const { container } = render(<BacklogSummarySection summary={"   \n  "} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Summary heading when summary is provided", () => {
    render(<BacklogSummarySection summary={SHORT} defaultOpen />);
    expect(screen.getByText("Summary")).toBeTruthy();
  });
});

describe("BacklogSummarySection — defaultOpen=true (done items)", () => {
  it("shows the full text when opened", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen />);
    expect(screen.getByTestId("summary-full")).toBeTruthy();
    expect(screen.getByTestId("summary-full").textContent).toBe(LONG);
  });

  it("sets aria-expanded=true on the toggle button", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen />);
    const btn = screen.getByLabelText("Collapse summary");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("does not render a preview node when expanded", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen />);
    expect(screen.queryByTestId("summary-preview")).toBeNull();
  });
});

describe("BacklogSummarySection — defaultOpen=false (collapsed)", () => {
  it("shows truncated preview with ellipsis when text > 120 chars", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen={false} />);
    const preview = screen.getByTestId("summary-preview");
    expect(preview.textContent).toMatch(/…$/);
    // Preview body length (without ellipsis) should be at most 120 chars
    expect((preview.textContent ?? "").length).toBeLessThanOrEqual(121);
  });

  it("shows full text without ellipsis when ≤120 chars", () => {
    render(<BacklogSummarySection summary={SHORT} defaultOpen={false} />);
    const preview = screen.getByTestId("summary-preview");
    expect(preview.textContent).toBe(SHORT);
    expect(preview.textContent).not.toMatch(/…$/);
  });

  it("sets aria-expanded=false when collapsed", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen={false} />);
    const btn = screen.getByLabelText("Expand summary");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders a 'Show more' button when text exceeds preview limit", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen={false} />);
    expect(screen.getByText("Show more")).toBeTruthy();
  });

  it("does not render 'Show more' button when summary fits in preview", () => {
    render(<BacklogSummarySection summary={SHORT} defaultOpen={false} />);
    expect(screen.queryByText("Show more")).toBeNull();
  });
});

describe("BacklogSummarySection — toggle interaction", () => {
  it("expands when the chevron toggle is clicked from collapsed state", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen={false} />);
    expect(screen.queryByTestId("summary-full")).toBeNull();

    const btn = screen.getByLabelText("Expand summary");
    fireEvent.click(btn);

    expect(screen.getByTestId("summary-full")).toBeTruthy();
    expect(screen.getByTestId("summary-full").textContent).toBe(LONG);
    expect(screen.queryByTestId("summary-preview")).toBeNull();
  });

  it("collapses again when toggle is clicked from expanded state", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen />);
    fireEvent.click(screen.getByLabelText("Collapse summary"));
    expect(screen.queryByTestId("summary-full")).toBeNull();
    expect(screen.getByTestId("summary-preview")).toBeTruthy();
  });

  it("'Show more' button also expands the section", () => {
    render(<BacklogSummarySection summary={LONG} defaultOpen={false} />);
    fireEvent.click(screen.getByText("Show more"));
    expect(screen.getByTestId("summary-full")).toBeTruthy();
  });
});
