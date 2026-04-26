import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TaskSection, WontDoItemRow, computeBuckets, parseTaskIdNumber } from "./tasks-client";
import { CollapsibleSection } from "@/components/collapsible-section";
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
    status: "done",
    section: "triaged",
    ...overrides,
  };
}

describe("TaskSection — cost badge rendering", () => {
  it("renders $X.XX badge for done items with positive cost_usd", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T020", title: "Cost tracking", cost_usd: 1.42 }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).toContain("$1.42");
  });

  it("does not render cost badge when cost_usd is 0", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T021", title: "Zero cost", cost_usd: 0 }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$");
    expect(container.textContent).not.toContain("0.00");
  });

  it("does not render cost badge when cost_usd is undefined", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T022", title: "Undef cost", cost_usd: undefined }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$");
  });

  it("does not render cost badge for non-done items even if cost_usd is set", () => {
    const items: TaskItem[] = [
      makeItem({
        id: "T023",
        title: "Planned with cost",
        status: "planned",
        cost_usd: 2.0,
      }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    expect(container.textContent).not.toContain("$2.00");
    expect(container.textContent).not.toContain("$");
  });

  it("renders a cost badge only for the done item in a mixed list", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T030", title: "Done with cost", status: "done", cost_usd: 1.42 }),
      makeItem({ id: "T031", title: "Done zero", status: "done", cost_usd: 0 }),
      makeItem({ id: "T032", title: "Done undef", status: "done", cost_usd: undefined }),
      makeItem({ id: "T033", title: "Planned with cost", status: "planned", cost_usd: 2.0 }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    const dollarCount = (container.textContent?.match(/\$/g) ?? []).length;
    expect(dollarCount).toBe(1);
    expect(container.textContent).toContain("$1.42");
    expect(container.textContent).not.toContain("$0.00");
    expect(container.textContent).not.toContain("$2.00");
  });

  it("uses font-mono class on the cost span", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T040", title: "Mono", cost_usd: 3.5 }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    const spans = Array.from(container.querySelectorAll("span.font-mono"));
    const costSpan = spans.find((el) => el.textContent?.startsWith("$"));
    expect(costSpan).toBeTruthy();
    expect(costSpan?.textContent).toBe("$3.50");
  });

  it("renders nothing when items list is empty", () => {
    const { container } = render(
      <TaskSection label="Triaged" items={[]} projectId={0} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("computeBuckets — planned/done/wontdo separation", () => {
  it("doneItems contains only status === 'done' items", () => {
    const all: TaskItem[] = [
      makeItem({ id: "T001", status: "done", section: "triaged" }),
      makeItem({ id: "T002", status: "pending", section: "triaged" }),
      makeItem({ id: "T003", status: "done", section: "ceo" }),
      makeItem({ id: "T004", status: "planned", section: "discovered" }),
    ];
    const { doneItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual(["T003", "T001"]);
    expect(doneItems.every((i) => i.status === "done")).toBe(true);
  });

  it("plannedItems contains no done items", () => {
    const all: TaskItem[] = [
      makeItem({ id: "T010", status: "done", section: "triaged" }),
      makeItem({ id: "T011", status: "pending", section: "triaged" }),
      makeItem({ id: "T012", status: "planned", section: "ceo" }),
      makeItem({ id: "T013", status: "pending-triage", section: "discovered" }),
    ];
    const { plannedItems } = computeBuckets(all, null);
    expect(plannedItems.every((i) => i.status !== "done")).toBe(true);
    expect(plannedItems.map((i) => i.id)).toEqual(["T011", "T012", "T013"]);
  });

  it("doneItems sorted descending by numeric T ID (T041 before T039)", () => {
    const all: TaskItem[] = [
      makeItem({ id: "T005", status: "done", section: "triaged" }),
      makeItem({ id: "T041", status: "done", section: "triaged" }),
      makeItem({ id: "T039", status: "done", section: "ceo" }),
      makeItem({ id: "T012", status: "done", section: "discovered" }),
    ];
    const { doneItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual([
      "T041",
      "T039",
      "T012",
      "T005",
    ]);
  });

  it("active item excluded from both plannedItems and doneItems", () => {
    const all: TaskItem[] = [
      makeItem({ id: "T020", status: "in-progress", section: "triaged" }),
      makeItem({ id: "T021", status: "pending", section: "triaged" }),
      makeItem({ id: "T022", status: "done", section: "triaged" }),
    ];
    const { plannedItems, doneItems } = computeBuckets(all, "T020");
    expect(plannedItems.map((i) => i.id)).not.toContain("T020");
    expect(doneItems.map((i) => i.id)).not.toContain("T020");
    expect(plannedItems.map((i) => i.id)).toEqual(["T021"]);
    expect(doneItems.map((i) => i.id)).toEqual(["T022"]);
  });

  it("item with status=wontdo goes to wontDoItems only, regardless of section", () => {
    const all: TaskItem[] = [
      makeItem({ id: "T010", status: "wontdo", section: "ceo" }),
      makeItem({ id: "T014", status: "wontdo", section: "discovered" }),
      makeItem({ id: "T011", status: "done", section: "triaged" }),
    ];
    const { doneItems, plannedItems, wontDoItems } = computeBuckets(all, null);
    expect(doneItems.map((i) => i.id)).toEqual(["T011"]);
    expect(wontDoItems.map((i) => i.id).sort()).toEqual(["T010", "T014"]);
    expect(doneItems.map((i) => i.id)).not.toContain("T010");
    expect(plannedItems.map((i) => i.id)).not.toContain("T010");
    expect(plannedItems.map((i) => i.id)).not.toContain("T014");
  });
});

describe("TaskSection — count badge in header", () => {
  it("renders the item count in the section header", () => {
    const items: TaskItem[] = [
      makeItem({ id: "T001", status: "pending" }),
      makeItem({ id: "T002", status: "planned" }),
    ];
    const { container } = render(
      <TaskSection label="Triaged" items={items} projectId={0} />
    );
    // The SectionHeader renders a count badge with the number
    const countBadge = container.querySelector(".rounded-full");
    expect(countBadge?.textContent).toBe("2");
  });

  it("renders rounded-xl on item rows", () => {
    const items: TaskItem[] = [makeItem({ id: "T005", status: "pending" })];
    const { container } = render(
      <TaskSection label="CEO Requests" items={items} projectId={0} />
    );
    const row = container.querySelector(".rounded-xl");
    expect(row).not.toBeNull();
  });
});

describe("parseTaskIdNumber", () => {
  it("extracts numeric portion from T-prefixed id", () => {
    expect(parseTaskIdNumber("T001")).toBe(1);
    expect(parseTaskIdNumber("T075")).toBe(75);
    expect(parseTaskIdNumber("T1234")).toBe(1234);
  });
  it("returns 0 for malformed ids", () => {
    expect(parseTaskIdNumber("")).toBe(0);
    expect(parseTaskIdNumber("not-a-task")).toBe(0);
  });
});

describe("WontDoItemRow — reason rendering (T065)", () => {
  it("renders the reason text when item.reason is present", () => {
    const item = makeItem({
      id: "T099",
      title: "Rejected feature",
      status: "wontdo",
      section: "wontdo",
      reason: "Superseded by T100 which covers the same requirement.",
    });
    const { container } = render(<WontDoItemRow item={item} projectId={0} />);
    expect(container.textContent).toContain(
      "Superseded by T100 which covers the same requirement."
    );
    const reasonEl = container.querySelector("[data-testid=wontdo-reason]");
    expect(reasonEl).not.toBeNull();
    expect(reasonEl?.className).toContain("text-xs");
    expect(reasonEl?.className).toContain("mt-1");
  });

  it("does not render a reason element when item.reason is absent", () => {
    const item = makeItem({
      id: "T098",
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
      id: "T097",
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

describe("Tasks page metadata (T077)", () => {
  it("page module exports metadata with title 'Tasks'", async () => {
    const mod = await import("./page");
    expect(mod.metadata).toBeDefined();
    expect((mod.metadata as { title: string }).title).toBe("Tasks");
  });
});
