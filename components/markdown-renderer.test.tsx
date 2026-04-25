import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "./markdown-renderer";

// react-markdown renders fine in happy-dom; no mock needed here.
// This test file is NOT dynamically imported — it tests the raw component.

describe("MarkdownRenderer", () => {
  it("renders plain text as a paragraph", () => {
    render(<MarkdownRenderer>Hello, world!</MarkdownRenderer>);
    expect(screen.getByText("Hello, world!")).toBeTruthy();
  });

  it("renders bold markdown", () => {
    const { container } = render(<MarkdownRenderer>**bold**</MarkdownRenderer>);
    expect(container.querySelector("strong")).toBeTruthy();
  });

  it("renders a markdown code span", () => {
    const { container } = render(<MarkdownRenderer>{"`code`"}</MarkdownRenderer>);
    expect(container.querySelector("code")).toBeTruthy();
  });

  it("renders GFM strikethrough via remark-gfm", () => {
    // remark-gfm enables ~~strikethrough~~
    const { container } = render(
      <MarkdownRenderer>{"~~struck~~"}</MarkdownRenderer>
    );
    expect(container.querySelector("del")).toBeTruthy();
  });

  it("wraps content in a div when className is provided", () => {
    const { container } = render(
      <MarkdownRenderer className="prose">Hello</MarkdownRenderer>
    );
    const wrapper = container.querySelector("div.prose");
    expect(wrapper).toBeTruthy();
  });

  it("does not add wrapper div when no className is provided", () => {
    const { container } = render(<MarkdownRenderer>Hello</MarkdownRenderer>);
    // No extra wrapper div — content goes directly into the container's first child (a <p>)
    expect(container.firstChild?.nodeName).toBe("P");
  });

  it("passes custom components to react-markdown", () => {
    const CustomParagraph = vi.fn(({ children }: { children: React.ReactNode }) => (
      <p data-testid="custom-p">{children}</p>
    ));
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MarkdownRenderer components={{ p: CustomParagraph as any }}>
        {"Hello custom"}
      </MarkdownRenderer>
    );
    expect(screen.getByTestId("custom-p")).toBeTruthy();
    expect(CustomParagraph).toHaveBeenCalled();
  });
});
