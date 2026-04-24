import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ShippedCard } from "./shipped-card";
import type { BacklogItem } from "@/lib/redeye-types";

// Mock next/link used inside BacklogId
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

function makeItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: "BL-015",
    title: "Add cost tracking",
    status: "done",
    section: "triaged",
    ...overrides,
  };
}

describe("ShippedCard — empty state", () => {
  it("shows 'Nothing shipped yet' when items list is empty", () => {
    render(<ShippedCard items={[]} />);
    expect(screen.getByText("Nothing shipped yet")).toBeTruthy();
  });
});

describe("ShippedCard — backlog item rendering without cost", () => {
  it("renders item id and title", () => {
    const item = makeItem();
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).toContain("BL-015");
    expect(container.textContent).toContain("Add cost tracking");
  });

  it("does not render a cost badge when cost_usd is undefined", () => {
    const item = makeItem({ cost_usd: undefined });
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).not.toContain("$");
  });

  it("does not render a cost badge when cost_usd is 0", () => {
    const item = makeItem({ cost_usd: 0 });
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).not.toContain("$");
  });
});

describe("ShippedCard — cost badge rendering", () => {
  it("renders cost badge with two decimal places when cost_usd > 0", () => {
    const item = makeItem({ cost_usd: 1.42 });
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).toContain("$1.42");
  });

  it("renders cost badge formatted to 2 decimal places (rounds)", () => {
    const item = makeItem({ cost_usd: 0.3845 });
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).toContain("$0.38");
  });

  it("renders cost badge for only items that have cost_usd > 0", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-015", title: "With cost", cost_usd: 1.42 }),
      makeItem({ id: "BL-016", title: "Without cost", cost_usd: undefined }),
    ];
    const { container } = render(<ShippedCard items={items} />);
    // BL-015 should show $1.42
    expect(container.textContent).toContain("$1.42");
    // BL-016 should not introduce a separate $ sign
    // Count $ signs — should be exactly 1
    const dollarCount = (container.textContent?.match(/\$/g) ?? []).length;
    expect(dollarCount).toBe(1);
  });

  it("applies font-mono class to cost badge", () => {
    const item = makeItem({ cost_usd: 2.0 });
    const { container } = render(<ShippedCard items={[item]} />);
    // Find the span that contains the dollar sign — it should have font-mono
    const spans = Array.from(container.querySelectorAll("span.font-mono"));
    const costSpan = spans.find((el) => el.textContent?.startsWith("$"));
    expect(costSpan).toBeTruthy();
    expect(costSpan?.textContent).toBe("$2.00");
  });
});

describe("ShippedCard — summary snippet (BL-026)", () => {
  it("renders a short summary verbatim beneath the title", () => {
    const item = makeItem({
      id: "BL-100",
      title: "Short summary item",
      summary: "All tests pass; visual verified.",
    });
    render(<ShippedCard items={[item]} />);
    const snippet = screen.getByTestId("shipped-summary-BL-100");
    expect(snippet.textContent).toBe("All tests pass; visual verified.");
    expect(snippet.textContent).not.toMatch(/…$/);
  });

  it("truncates a long summary to ≤80 chars with ellipsis", () => {
    const longText =
      "User message boxes in the Live tab transcript are now collapsible and collapsed by default, reducing visual noise considerably across long sessions.";
    const item = makeItem({
      id: "BL-101",
      title: "Long summary item",
      summary: longText,
    });
    render(<ShippedCard items={[item]} />);
    const snippet = screen.getByTestId("shipped-summary-BL-101");
    expect(snippet.textContent).toMatch(/…$/);
    // Snippet body without ellipsis should be ≤80 chars
    expect((snippet.textContent ?? "").length).toBeLessThanOrEqual(81);
    // Truncation must drop the second sentence
    expect(snippet.textContent).not.toContain("considerably");
  });

  it("does not render a snippet when item has no summary", () => {
    const item = makeItem({ id: "BL-102", summary: undefined });
    render(<ShippedCard items={[item]} />);
    expect(screen.queryByTestId("shipped-summary-BL-102")).toBeNull();
  });

  it("renders snippets for multiple items independently", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-103", title: "First", summary: "First summary text." }),
      makeItem({ id: "BL-104", title: "Second", summary: undefined }),
      makeItem({ id: "BL-105", title: "Third", summary: "Third summary text." }),
    ];
    render(<ShippedCard items={items} />);
    expect(screen.getByTestId("shipped-summary-BL-103")).toBeTruthy();
    expect(screen.queryByTestId("shipped-summary-BL-104")).toBeNull();
    expect(screen.getByTestId("shipped-summary-BL-105")).toBeTruthy();
  });

  it("does not render summary snippets in the changelog branch", () => {
    const entries = [
      { title: "Shipped feature", details: "**Built:** BL-106", date: "2026-04-24" },
    ];
    const items: BacklogItem[] = [
      makeItem({ id: "BL-106", summary: "Should be ignored under changelog mode." }),
    ];
    render(<ShippedCard items={items} changelog={entries} />);
    expect(screen.queryByTestId("shipped-summary-BL-106")).toBeNull();
  });
});

describe("ShippedCard — changelog path is unaffected", () => {
  it("renders changelog entries when changelog prop provided", () => {
    const entries = [
      { title: "Shipped feature", details: "**Built:** BL-015", date: "2026-04-24" },
    ];
    const { container } = render(
      <ShippedCard items={[]} changelog={entries} />
    );
    expect(container.textContent).toContain("Shipped feature");
  });

  it("does not render cost badge in changelog render path", () => {
    const entries = [
      { title: "Shipped feature", details: "**Built:** BL-015", date: "2026-04-24" },
    ];
    // Pass items with cost_usd — they should be ignored when changelog is present
    const items: BacklogItem[] = [makeItem({ cost_usd: 5.0 })];
    const { container } = render(
      <ShippedCard items={items} changelog={entries} />
    );
    // Changelog path: no cost badge
    expect(container.textContent).not.toContain("$5.00");
  });
});
