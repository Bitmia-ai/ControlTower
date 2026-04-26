import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import TaskDetailClient from "./task-detail-client";
import type { TaskItem } from "@/lib/redeye-types";

// Mocks that need to be defined before component import isn't necessary
// (vi.mock calls are hoisted), but group them for clarity.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

vi.mock("@/components/task-id", () => ({
  TaskId: ({ id }: { id: string }) => <span>{id}</span>,
}));

vi.mock("@/components/fetch-error", () => ({
  FetchError: ({ message }: { message: string }) => <div>{message}</div>,
}));

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makeItem(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "T042",
    title: "Test task",
    status: "done",
    section: "triaged",
    ...overrides,
  };
}

function makeParams(id: string, taskId: string) {
  // The page consumes params via React.use(); passing a resolved Promise works.
  return Promise.resolve({ id, taskId });
}

describe("TaskDetailClient — cost row + Record now button", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders 'Not recorded' + 'Record now' button for done item with no cost", async () => {
    const item = makeItem({ cost_usd: undefined });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeResponse({ data: item })
    );

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T042")} />);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/projects/0/tasks/T042");
    });

    await waitFor(() => {
      expect(screen.getByText("Not recorded")).toBeTruthy();
    });

    const recordBtn = screen.getByRole("button", { name: /Record now/ });
    expect(recordBtn).toBeTruthy();
  });

  it("renders $X.XX and no 'Record now' button for done item with cost_usd > 0", async () => {
    const item = makeItem({ cost_usd: 1.42 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeResponse({ data: item }));

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T042")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("$1.42")).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: /Record now/ })).toBeNull();
    expect(screen.queryByText("Not recorded")).toBeNull();
  });

  it("clicking 'Record now' POSTs to cost-snapshot and refreshes cost", async () => {
    const itemNoCost = makeItem({ cost_usd: undefined });
    const itemWithCost = makeItem({ cost_usd: 2.37 });

    // POST flips a flag so subsequent GETs return the updated item with cost.
    let snapshotRecorded = false;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url === "/api/projects/0/cost-snapshot" && method === "POST") {
          snapshotRecorded = true;
          return makeResponse({
            data: { blId: "T042", cost_usd: 2.37, recorded: true },
          });
        }
        if (url === "/api/projects/0/tasks/T042") {
          return makeResponse({
            data: snapshotRecorded ? itemWithCost : itemNoCost,
          });
        }
        return makeResponse({ error: "not-mocked" }, 500);
      }
    );

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T042")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Record now/ })).toBeTruthy();
    });

    const btn = screen.getByRole("button", { name: /Record now/ });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(screen.getByText("$2.37")).toBeTruthy();
    });

    // Verify POST was called with correct body
    const postCall = fetchMock.mock.calls.find(
      ([url, reqInit]) =>
        url === "/api/projects/0/cost-snapshot" &&
        (reqInit as RequestInit | undefined)?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    const postInit = postCall![1] as RequestInit;
    expect(JSON.parse(postInit.body as string)).toEqual({ blId: "T042" });

    // Button should no longer be rendered
    expect(screen.queryByRole("button", { name: /Record now/ })).toBeNull();
  });

  it("shows inline message when cost-snapshot returns recorded: false", async () => {
    const item = makeItem({ cost_usd: undefined });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url === "/api/projects/0/cost-snapshot" && method === "POST") {
          return makeResponse({ data: { blId: "T042", cost_usd: 0, recorded: false } });
        }
        return makeResponse({ data: item });
      }
    );

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T042")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Record now/ })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Record now/ }));
    });

    await waitFor(() => {
      expect(screen.getByText("No active transcript — cost not captured.")).toBeTruthy();
    });

    // "Record now" button still present (user can retry)
    expect(screen.getByRole("button", { name: /Record now/ })).toBeTruthy();
  });

  it("does not render cost row for non-done items", async () => {
    const item = makeItem({ status: "planned", cost_usd: undefined });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeResponse({ data: item }));

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T042")} />);
    });

    await waitFor(() => {
      // Wait for initial load to finish — the status badge in the header will appear.
      expect(screen.getAllByText("planned").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Cost (est.)")).toBeNull();
    expect(screen.queryByText("Not recorded")).toBeNull();
    expect(screen.queryByRole("button", { name: /Record now/ })).toBeNull();
  });
});

describe("Task detail page metadata (T077)", () => {
  it("page module exports metadata with title 'Task Detail'", async () => {
    const mod = await import("./page");
    expect(mod.metadata).toBeDefined();
    expect((mod.metadata as { title: string }).title).toBe("Task Detail");
  });
});
