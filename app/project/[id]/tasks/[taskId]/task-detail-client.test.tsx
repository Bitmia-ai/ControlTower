import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, waitFor, fireEvent } from "@testing-library/react";
import TaskDetailClient from "./task-detail-client";
import type { TaskItem } from "@/lib/redeye-types";
import type { TaskDurationResult } from "@/lib/task-duration";

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
  default: ({ children }: { children: string }) => <div>{children}</div>,
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
    id: "T119",
    title: "Task 119",
    status: "done",
    section: "triaged",
    cost_usd: 2.5,
    ...overrides,
  };
}

function makeDuration(
  overrides: Partial<TaskDurationResult> = {}
): TaskDurationResult {
  return {
    taskId: "T119",
    durationMs: 5 * 3_600_000,
    planStartIso: "2026-04-27T09:00:00Z",
    mergeEndIso: "2026-04-27T14:00:00Z",
    phaseBreakdown: [],
    formattedDuration: "5h",
    costUsd: 2.5,
    hourlyRate: "$0.50/hr",
    ...overrides,
  };
}

function makeParams(id: string, taskId: string) {
  return Promise.resolve({ id, taskId });
}

/**
 * Wires up a fetch mock that handles both task and duration endpoints.
 * `taskBody` and `durationBody` may be functions to allow per-call control.
 */
function mockFetches(opts: {
  task?: unknown;
  duration?: unknown | null;
  durationStatus?: number;
  durationFails?: boolean;
}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/duration")) {
        if (opts.durationFails) throw new Error("network down");
        if (opts.durationStatus && opts.durationStatus >= 400) {
          return makeResponse({ error: "fail" }, opts.durationStatus);
        }
        return makeResponse(opts.duration);
      }
      return makeResponse(opts.task);
    });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TaskDetailClient — duration fetching (T119)", () => {
  it("does not call duration API when status is not 'done'", async () => {
    const item = makeItem({ status: "in-progress" });
    const fetchSpy = mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/projects/0/tasks/T119");
    });

    // Give any pending microtasks a chance to fire
    await act(async () => {});

    const durationCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).endsWith("/duration")
    );
    expect(durationCalls).toHaveLength(0);
  });

  it("renders Duration row with formattedDuration when API returns durationMs", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: { data: makeDuration({ formattedDuration: "5h" }) },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Duration")).toBeTruthy();
    });
    expect(screen.getByText("5h")).toBeTruthy();
  });

  it("does NOT render Duration row when durationMs is null", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: {
        data: makeDuration({
          durationMs: null,
          formattedDuration: null,
          hourlyRate: null,
        }),
      },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    // Wait until the cost row appears (proxy for done-task render complete)
    await waitFor(() => {
      expect(screen.getByText("Cost (est.)")).toBeTruthy();
    });

    expect(screen.queryByText("Duration")).toBeNull();
  });

  it("does not crash when duration fetch fails", async () => {
    mockFetches({ task: { data: makeItem() }, durationFails: true });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Cost (est.)")).toBeTruthy();
    });

    expect(screen.queryByText("Duration")).toBeNull();
  });

  it("does not render Duration row when API returns non-ok status", async () => {
    mockFetches({
      task: { data: makeItem() },
      durationStatus: 500,
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Cost (est.)")).toBeTruthy();
    });

    expect(screen.queryByText("Duration")).toBeNull();
  });

  it("renders Rate row when hourlyRate is present", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: { data: makeDuration({ hourlyRate: "$0.50/hr" }) },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Rate")).toBeTruthy();
    });
    expect(screen.getByText("$0.50/hr")).toBeTruthy();
  });

  it("does NOT render Rate row when hourlyRate is null", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: { data: makeDuration({ hourlyRate: null }) },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Duration")).toBeTruthy();
    });
    expect(screen.queryByText("Rate")).toBeNull();
  });

  it("renders Phase Breakdown details when phaseBreakdown has 2+ entries", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: {
        data: makeDuration({
          phaseBreakdown: [
            { phase: "BUILD", durationMs: 7_200_000, formattedDuration: "2h" },
            { phase: "REVIEW", durationMs: 3_600_000, formattedDuration: "1h" },
          ],
        }),
      },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Phase Breakdown")).toBeTruthy();
    });
    expect(screen.getByText("BUILD")).toBeTruthy();
    expect(screen.getByText("REVIEW")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
    expect(screen.getByText("1h")).toBeTruthy();
  });

  it("does NOT render Phase Breakdown when phaseBreakdown has fewer than 2 entries", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: {
        data: makeDuration({
          phaseBreakdown: [
            { phase: "BUILD", durationMs: 7_200_000, formattedDuration: "2h" },
          ],
        }),
      },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Duration")).toBeTruthy();
    });
    expect(screen.queryByText("Phase Breakdown")).toBeNull();
  });

  it("seeds edit textarea from description (T122)", async () => {
    const item = makeItem({
      status: "pending",
      description: "primary description text",
      details: "- legacy detail bullet",
    });
    mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeTruthy();
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Edit$/ }).click();
    });

    const textarea = screen.getByPlaceholderText(/Optional notes/) as HTMLTextAreaElement;
    expect(textarea.value).toBe("primary description text");
  });

  it("falls back to details when description is missing (T122)", async () => {
    const item = makeItem({
      status: "pending",
      description: undefined,
      details: "- legacy detail bullet",
    });
    mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeTruthy();
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Edit$/ }).click();
    });

    const textarea = screen.getByPlaceholderText(/Optional notes/) as HTMLTextAreaElement;
    expect(textarea.value).toBe("- legacy detail bullet");
  });

  it("seeds edit textarea empty when neither description nor details (T122)", async () => {
    const item = makeItem({
      status: "pending",
      description: undefined,
      details: undefined,
    });
    mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeTruthy();
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Edit$/ }).click();
    });

    const textarea = screen.getByPlaceholderText(/Optional notes/) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("PATCH body sends description (not details) on save (T122)", async () => {
    const item = makeItem({
      status: "pending",
      description: "old desc",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.endsWith("/duration")) return makeResponse({ data: null });
        if (init?.method === "PATCH") {
          return makeResponse({ data: { ...item, description: "edited desc" } });
        }
        return makeResponse({ data: item });
      }
    );

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Edit$/ })).toBeTruthy();
    });

    await act(async () => {
      screen.getByRole("button", { name: /^Edit$/ }).click();
    });

    const textarea = screen.getByPlaceholderText(/Optional notes/) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "edited desc" } });
    });

    await act(async () => {
      screen.getByRole("button", { name: /Save/ }).click();
    });

    const patchCall = fetchSpy.mock.calls.find(
      ([, opts]) => (opts as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeTruthy();
    const body = JSON.parse((patchCall![1] as RequestInit).body as string);
    expect(body.description).toBe("edited desc");
    expect(body.details).toBeUndefined();
  });

  it("renders 'Created by' row with 'Created by User' badge for ceo-section items (T134/T135)", async () => {
    const item = makeItem({ status: "pending", section: "ceo" });
    mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Created by")).toBeTruthy();
    });

    const badge = screen.getByTestId("task-detail-author-badge");
    expect(badge.textContent).toBe("Created by User");
    expect(badge.className).toContain("bg-blue-50");
  });

  it("renders 'Created by' row with 'Created by RedEye' badge for discovered items (T134/T135)", async () => {
    const item = makeItem({ status: "pending", section: "discovered" });
    mockFetches({ task: { data: item } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Created by")).toBeTruthy();
    });

    const badge = screen.getByTestId("task-detail-author-badge");
    expect(badge.textContent).toBe("Created by RedEye");
    expect(badge.className).toContain("bg-violet-50");
  });

  it("renders 'Created by' row even when item.section is triaged (T134/T135)", async () => {
    const item = makeItem({ status: "done", section: "triaged" });
    mockFetches({ task: { data: item }, duration: { data: null } });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Created by")).toBeTruthy();
    });
    expect(screen.getByTestId("task-detail-author-badge").textContent).toBe(
      "Created by RedEye"
    );
  });

  it("renders both Duration and Rate together when both available", async () => {
    mockFetches({
      task: { data: makeItem() },
      duration: {
        data: makeDuration({
          formattedDuration: "3h 42m",
          hourlyRate: "$0.57/hr",
        }),
      },
    });

    await act(async () => {
      render(<TaskDetailClient params={makeParams("0", "T119")} />);
    });

    await waitFor(() => {
      expect(screen.getByText("3h 42m")).toBeTruthy();
    });
    expect(screen.getByText("$0.57/hr")).toBeTruthy();
  });
});
