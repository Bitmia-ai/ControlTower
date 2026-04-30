import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PageHeader } from "./page-header";

afterEach(() => {
  cleanup();
});

describe("PageHeader", () => {
  it("renders the eyebrow", () => {
    render(<PageHeader eyebrow="Control Tower" title="Tasks" />);
    expect(screen.getByText("Control Tower")).toBeTruthy();
  });

  it("renders the title in an h1", () => {
    render(<PageHeader eyebrow="Control Tower" title="Tasks" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Tasks");
  });

  it("renders the subtitle when provided", () => {
    render(
      <PageHeader eyebrow="CT" title="Tasks" subtitle="3 items" />
    );
    expect(screen.getByText("3 items")).toBeTruthy();
  });

  it("does not render subtitle paragraph when subtitle is omitted", () => {
    const { container } = render(<PageHeader eyebrow="CT" title="Tasks" />);
    // Only the eyebrow paragraph (1) should exist; no subtitle paragraph.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1);
  });

  it("renders actions when provided", () => {
    render(
      <PageHeader
        eyebrow="CT"
        title="Tasks"
        actions={<button>+ Add</button>}
      />
    );
    expect(screen.getByRole("button", { name: "+ Add" })).toBeTruthy();
  });

  it("uses a banner/header element", () => {
    const { container } = render(<PageHeader eyebrow="CT" title="Tasks" />);
    expect(container.querySelector("header")).toBeTruthy();
  });
});
