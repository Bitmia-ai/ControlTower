import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader } from "./section-header";

describe("SectionHeader", () => {
  it("renders the label text", () => {
    render(<SectionHeader label="Backlog" />);
    expect(screen.getByText("Backlog")).toBeDefined();
  });

  it("renders icon when provided", () => {
    render(
      <SectionHeader
        label="History"
        icon={<svg data-testid="icon" />}
      />
    );
    expect(screen.getByTestId("icon")).toBeDefined();
  });

  it("does not render icon wrapper when no icon provided", () => {
    const { container } = render(<SectionHeader label="Live" />);
    // No aria-hidden span for icon
    const iconSpan = container.querySelector('[aria-hidden="true"]');
    expect(iconSpan).toBeNull();
  });

  it("renders count badge when count is provided", () => {
    render(<SectionHeader label="Done" count={42} />);
    expect(screen.getByText("42")).toBeDefined();
  });

  it("does not render count badge when count is undefined", () => {
    render(<SectionHeader label="Triaged" />);
    // Only one text node — the label
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders count of 0 when explicitly passed", () => {
    render(<SectionHeader label="Empty" count={0} />);
    expect(screen.getByText("0")).toBeDefined();
  });

  it("applies additional className to wrapper", () => {
    const { container } = render(
      <SectionHeader label="Backlog" className="mb-4" />
    );
    expect(container.firstElementChild?.className).toContain("mb-4");
  });
});
