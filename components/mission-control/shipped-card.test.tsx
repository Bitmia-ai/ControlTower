import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ShippedCard } from "./shipped-card";
import type { TaskItem } from "@/lib/redeye-types";

// Mock next/link used inside TaskId
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

// Mock formatRelativeTime so ShippedCard tests are date-independent.
vi.mock("@/lib/format-relative-time", () => ({
  formatRelativeTime: (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return `${dateStr} — relative`;
  },
}));

afterEach(() => {
  cleanup();
});

function makeItem(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "T015",
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

describe("ShippedCard — task rendering without cost", () => {
  it("renders item id and title", () => {
    const item = makeItem();
    const { container } = render(<ShippedCard items={[item]} />);
    expect(container.textContent).toContain("T015");
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
    const items: TaskItem[] = [
      makeItem({ id: "T015", title: "With cost", cost_usd: 1.42 }),
      makeItem({ id: "T016", title: "Without cost", cost_usd: undefined }),
    ];
    const { container } = render(<ShippedCard items={items} />);
    // T015 should show $1.42
    expect(container.textContent).toContain("$1.42");
    // T016 should not introduce a separate $ sign
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

describe("ShippedCard — summary snippet (T026)", () => {
  it("renders a short summary verbatim beneath the title", () => {
    const item = makeItem({
      id: "T100",
      title: "Short summary item",
      summary: "All tests pass; visual verified.",
    });
    render(<ShippedCard items={[item]} />);
    const snippet = screen.getByTestId("shipped-summary-T100");
    expect(snippet.textContent).toBe("All tests pass; visual verified.");
    expect(snippet.textContent).not.toMatch(/…$/);
  });

  it("truncates a long summary to ≤80 chars with ellipsis", () => {
    const longText =
      "User message boxes in the Live tab transcript are now collapsible and collapsed by default, reducing visual noise considerably across long sessions.";
    const item = makeItem({
      id: "T101",
      title: "Long summary item",
      summary: longText,
    });
    render(<ShippedCard items={[item]} />);
    const snippet = screen.getByTestId("shipped-summary-T101");
    expect(snippet.textContent).toMatch(/…$/);
    // Snippet body without ellipsis should be ≤80 chars
    expect((snippet.textContent ?? "").length).toBeLessThanOrEqual(81);
    // Truncation must drop the second sentence
    expect(snippet.textContent).not.toContain("considerably");
  });

  it("does not render a snippet when item has no summary", () => {
    const item = makeItem({ id: "T102", summary: undefined });
    render(<ShippedCard items={[item]} />);
    expect(screen.queryByTestId("shipped-summary-T102")).toBeNull();
  });

  it("renders snippets for multiple items independently", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T103", title: "First", summary: "First summary text." }),
      makeItem({ id: "T104", title: "Second", summary: undefined }),
      makeItem({ id: "T105", title: "Third", summary: "Third summary text." }),
    ];
    render(<ShippedCard items={items} />);
    expect(screen.getByTestId("shipped-summary-T103")).toBeTruthy();
    expect(screen.queryByTestId("shipped-summary-T104")).toBeNull();
    expect(screen.getByTestId("shipped-summary-T105")).toBeTruthy();
  });

  it("does not render summary snippets in the changelog branch", () => {
    // The changelog branch only renders when items is empty (items is ground
    // truth; changelog is the fallback). Pass items=[] to actually exercise
    // the changelog render path. Summaries are an items-only concept, so the
    // changelog branch must not surface a `shipped-summary-*` testid.
    const entries = [
      { title: "Shipped feature", details: "**Built:** T106", date: "2026-04-24" },
    ];
    render(<ShippedCard items={[]} changelog={entries} />);
    expect(screen.queryByTestId("shipped-summary-T106")).toBeNull();
  });
});

describe("ShippedCard — changelog path is unaffected", () => {
  it("renders changelog entries when changelog prop provided", () => {
    const entries = [
      { title: "Shipped feature", details: "**Built:** T015", date: "2026-04-24" },
    ];
    const { container } = render(
      <ShippedCard items={[]} changelog={entries} />
    );
    expect(container.textContent).toContain("Shipped feature");
  });

  it("does not render cost badge in changelog render path", () => {
    // Force the changelog render path by passing items=[]. The branch is
    // `items.length === 0 && changelog.length > 0` — items is ground truth,
    // changelog is only a fallback. The changelog markup omits cost badges
    // by design (changelog entries have no per-task cost data).
    const entries = [
      { title: "Shipped feature", details: "**Built:** T015", date: "2026-04-24" },
    ];
    const { container } = render(
      <ShippedCard items={[]} changelog={entries} />
    );
    // Changelog path: no cost badge
    expect(container.textContent).not.toContain("$");
  });
});

describe("ShippedCard — relative time (T082)", () => {
  it("renders relative time when item has mergedAt", () => {
    const item = makeItem({ id: "T200", mergedAt: "2026-04-25" });
    render(<ShippedCard items={[item]} />);
    const timeEl = screen.getByTestId("shipped-time-T200");
    // Our mock returns "<date> — relative"
    expect(timeEl.textContent).toBe("2026-04-25 — relative");
  });

  it("does not render a time element when mergedAt is null", () => {
    const item = makeItem({ id: "T201", mergedAt: null });
    render(<ShippedCard items={[item]} />);
    expect(screen.queryByTestId("shipped-time-T201")).toBeNull();
  });

  it("does not render a time element when mergedAt is undefined (old items)", () => {
    const item = makeItem({ id: "T202" }); // no mergedAt property
    render(<ShippedCard items={[item]} />);
    expect(screen.queryByTestId("shipped-time-T202")).toBeNull();
  });

  it("renders relative time independently for multiple items", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T203", mergedAt: "2026-04-26" }),
      makeItem({ id: "T204", mergedAt: null }),
      makeItem({ id: "T205", mergedAt: "2026-04-24" }),
    ];
    render(<ShippedCard items={items} />);
    expect(screen.getByTestId("shipped-time-T203")).toBeTruthy();
    expect(screen.queryByTestId("shipped-time-T204")).toBeNull();
    expect(screen.getByTestId("shipped-time-T205")).toBeTruthy();
  });
});
