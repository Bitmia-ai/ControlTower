import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BacklogSection, WontDoItemRow, computeBuckets, parseBacklogIdNumber } from "./page";
import { CollapsibleSection } from "@/components/collapsible-section";
import type { BacklogItem } from "@/lib/redeye-types";

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
    id: "BL-001",
    title: "Test item",
    status: "done",
    section: "triaged",
    ...overrides,
  };
}

describe("BacklogSection — cost badge rendering", () => {
  it("renders $X.XX badge for done items with positive cost_usd", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-020", title: "Cost tracking", cost_usd: 1.42 }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).toContain("$1.42");
  });

  it("does not render cost badge when cost_usd is 0", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-021", title: "Zero cost", cost_usd: 0 }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$");
    expect(container.textContent).not.toContain("0.00");
  });

  it("does not render cost badge when cost_usd is undefined", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-022", title: "Undef cost", cost_usd: undefined }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$");
  });

  it("does not render cost badge for non-done items even if cost_usd is set", () => {
    const items: BacklogItem[] = [
      makeItem({
        id: "BL-023",
        title: "Planned with cost",
        status: "planned",
        cost_usd: 2.0,
      }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$2.00");
    expect(container.textContent).not.toContain("$");
  });

  it("renders a cost badge only for the done item in a mixed list", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-030", title: "Done with cost", status: "done", cost_usd: 1.42 }),
      makeItem({ id: "BL-031", title: "Done zero", status: "done", cost_usd: 0 }),
      makeItem({ id: "BL-032", title: "Done undef", status: "done", cost_usd: undefined }),
      makeItem({ id: "BL-033", title: "Planned with cost", status: "planned", cost_usd: 2.0 }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    const dollarCount = (container.textContent?.match(/\$/g) ?? []).length;
    expect(dollarCount).toBe(1);
    expect(container.textContent).toContain("$1.42");
    expect(container.textContent).not.toContain("$0.00");
    expect(container.textContent).not.toContain("$2.00");
  });

  it("uses font-mono class on the cost span", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-040", title: "Mono", cost_usd: 3.5 }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    const spans = Array.from(container.querySelectorAll("span.font-mono"));
    const costSpan = spans.find((el) => el.textContent?.startsWith("$"));
    expect(costSpan).toBeTruthy();
    expect(costSpan?.textContent).toBe("$3.50");
  });

  it("renders nothing when items list is empty", () => {
    const { container } = render(
      <BacklogSection label="Triaged" items={[]} projectId={0} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("computeBuckets — planned/done/wontdo separation", () => {
  it("doneItems contains only status === 'done' items", () => {
    const all: BacklogItem[] = [
      makeItem({ id: "BL-001", status: "done", section: "triaged" }),
      makeItem({ id: "BL-002", status: "pending", section: "triaged" }),
      makeItem({ id: "BL-003", status: "done", section: "ceo" }),
      makeItem({ id: "BL-004", status: "planned", section: "discovered" }),
    ];
    const { doneItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual(["BL-003", "BL-001"]);
    expect(doneItems.every((i) => i.status === "done")).toBe(true);
  });

  it("plannedItems contains no done items", () => {
    const all: BacklogItem[] = [
      makeItem({ id: "BL-010", status: "done", section: "triaged" }),
      makeItem({ id: "BL-011", status: "pending", section: "triaged" }),
      makeItem({ id: "BL-012", status: "planned", section: "ceo" }),
      makeItem({ id: "BL-013", status: "pending-triage", section: "discovered" }),
    ];
    const { plannedItems } = computeBuckets(all, null);
    expect(plannedItems.every((i) => i.status !== "done")).toBe(true);
    expect(plannedItems.map((i) => i.id)).toEqual(["BL-011", "BL-012", "BL-013"]);
  });

  it("doneItems sorted descending by numeric BL ID (BL-041 before BL-039)", () => {
    const all: BacklogItem[] = [
      makeItem({ id: "BL-005", status: "done", section: "triaged" }),
      makeItem({ id: "BL-041", status: "done", section: "triaged" }),
      makeItem({ id: "BL-039", status: "done", section: "ceo" }),
      makeItem({ id: "BL-012", status: "done", section: "discovered" }),
    ];
    const { doneItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual([
      "BL-041",
      "BL-039",
      "BL-012",
      "BL-005",
    ]);
  });

  it("active item excluded from both plannedItems and doneItems", () => {
    const all: BacklogItem[] = [
      makeItem({ id: "BL-020", status: "in-progress", section: "triaged" }),
      makeItem({ id: "BL-021", status: "pending", section: "triaged" }),
      makeItem({ id: "BL-022", status: "done", section: "triaged" }),
    ];
    const { plannedItems, doneItems } = computeBuckets(all, "BL-020");
    expect(plannedItems.map((i) => i.id)).not.toContain("BL-020");
    expect(doneItems.map((i) => i.id)).not.toContain("BL-020");
    expect(plannedItems.map((i) => i.id)).toEqual(["BL-021"]);
    expect(doneItems.map((i) => i.id)).toEqual(["BL-022"]);
  });

  it("item with status=done and section=wontdo goes to wontDoItems only, not doneItems", () => {
    const all: BacklogItem[] = [
      makeItem({ id: "BL-010", status: "done", section: "wontdo" }),
      makeItem({ id: "BL-011", status: "done", section: "triaged" }),
    ];
    const { doneItems, wontDoItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual(["BL-011"]);
    expect(wontDoItems.map((i) => i.id)).toContain("BL-010");
    expect(doneItems.map((i) => i.id)).not.toContain("BL-010");
  });
});

describe("BacklogSection — count badge in header", () => {
  it("renders the item count in the section header", () => {
    const items: BacklogItem[] = [
      makeItem({ id: "BL-001", status: "pending" }),
      makeItem({ id: "BL-002", status: "planned" }),
    ];
    const { container } = render(
      <BacklogSection label="Triaged" items={items} projectId={0} />
    );
    // The SectionHeader renders a count badge with the number
    const countBadge = container.querySelector(".rounded-full");
    expect(countBadge?.textContent).toBe("2");
  });

  it("renders rounded-xl on item rows", () => {
    const items: BacklogItem[] = [makeItem({ id: "BL-005", status: "pending" })];
    const { container } = render(
      <BacklogSection label="CEO Requests" items={items} projectId={0} />
    );
    const row = container.querySelector(".rounded-xl");
    expect(row).not.toBeNull();
  });
});

describe("parseBacklogIdNumber", () => {
  it("parses BL-001 as 1", () => {
    expect(parseBacklogIdNumber("BL-001")).toBe(1);
  });
  it("parses BL-053 as 53", () => {
    expect(parseBacklogIdNumber("BL-053")).toBe(53);
  });
  it("returns 0 for malformed IDs", () => {
    expect(parseBacklogIdNumber("SCHED-001")).toBe(0);
    expect(parseBacklogIdNumber("")).toBe(0);
  });
});

describe("WontDoItemRow — reason rendering (BL-065)", () => {
  it("renders the reason text when item.reason is present", () => {
    const item = makeItem({
      id: "BL-099",
      title: "Rejected feature",
      status: "wontdo",
      section: "wontdo",
      reason: "Superseded by BL-100 which covers the same requirement.",
    });
    const { container } = render(<WontDoItemRow item={item} projectId={0} />);
    expect(container.textContent).toContain(
      "Superseded by BL-100 which covers the same requirement."
    );
    const reasonEl = container.querySelector("[data-testid=wontdo-reason]");
    expect(reasonEl).not.toBeNull();
    expect(reasonEl?.className).toContain("text-xs");
    expect(reasonEl?.className).toContain("mt-1");
  });

  it("does not render a reason element when item.reason is absent", () => {
    const item = makeItem({
      id: "BL-098",
      title: "Quietly dropped",
      status: "wontdo",
      section: "wontdo",
    });
    const { container } = render(<WontDoItemRow item={item} projectId={0} />);
    const reasonEl = container.querySelector("[data-testid=wontdo-reason]");
    expect(reasonEl).toBeNull();
  });

  it("keeps the strikethrough title link in either case", () => {
    const item = makeItem({
      id: "BL-097",
      title: "Strike me out",
      status: "wontdo",
      section: "wontdo",
      reason: "Some rationale.",
    });
    const { container } = render(<WontDoItemRow item={item} projectId={0} />);
    const titleLink = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Strike me out")
    );
    expect(titleLink).toBeTruthy();
    expect(titleLink?.className).toContain("line-through");
  });
});

describe("CollapsibleSection", () => {
  it("renders header with correct count badge", () => {
    render(
      <CollapsibleSection
        label="Done"
        count={42}
        open={false}
        onToggle={() => {}}
      >
        <div>hidden child</div>
      </CollapsibleSection>,
    );
    expect(screen.getByText("Done")).toBeTruthy();
    const countBadge = screen.getByTestId("collapsible-count");
    expect(countBadge.textContent).toBe("42");
  });

  it("renders children when open=true, hides when open=false", () => {
    const { rerender } = render(
      <CollapsibleSection
        label="Done"
        count={2}
        open={true}
        onToggle={() => {}}
      >
        <div data-testid="child">expanded child</div>
      </CollapsibleSection>,
    );
    expect(screen.queryByTestId("child")).toBeTruthy();

    rerender(
      <CollapsibleSection
        label="Done"
        count={2}
        open={false}
        onToggle={() => {}}
      >
        <div data-testid="child">expanded child</div>
      </CollapsibleSection>,
    );
    expect(screen.queryByTestId("child")).toBeNull();
  });

  it("toggle button inverts open state on click", () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection
        label="Done"
        count={3}
        open={false}
        onToggle={onToggle}
      >
        <div>child</div>
      </CollapsibleSection>,
    );
    const button = screen.getByRole("button", { name: /show done items/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
