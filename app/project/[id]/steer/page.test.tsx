import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { SteerContent } from "./page";
import type { SteeringDirective } from "@/lib/redeye-types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/project/0/steer",
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeDirective(text: string): SteeringDirective {
  return { text };
}

function mockFetchSequence(responses: Array<Partial<Response> & { json: () => Promise<unknown> }>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce(r as Response);
  }
  vi.spyOn(global, "fetch").mockImplementation(fetchMock);
  return fetchMock;
}

describe("SteerContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and form immediately", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));
    render(<SteerContent id="0" />);
    expect(screen.getByRole("heading", { name: "Steer", level: 1 })).toBeDefined();
    expect(screen.getByLabelText("New directive")).toBeDefined();
    expect(screen.getByRole("button", { name: /Send Directive/i })).toBeDefined();
  });

  it("shows skeleton while initial GET is loading", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));
    render(<SteerContent id="0" />);
    const skeleton = document.querySelector("[aria-busy='true']");
    expect(skeleton).not.toBeNull();
  });

  it("shows empty state when GET returns 0 directives", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives: [] } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No directives yet.")).toBeDefined();
    });
  });

  it("renders directive list when GET returns items", async () => {
    const directives = [
      makeDirective("Focus on UX (2026-04-25)"),
      makeDirective("Ship faster (2026-04-24)"),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("Focus on UX")).toBeDefined();
      expect(screen.getByText("Ship faster")).toBeDefined();
      // Date badges
      expect(screen.getByText("2026-04-25")).toBeDefined();
      expect(screen.getByText("2026-04-24")).toBeDefined();
    });
  });

  it("disables submit button when textarea is empty", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives: [] } }),
    } as Response);
    render(<SteerContent id="0" />);
    const button = screen.getByRole("button", { name: /Send Directive/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables submit button when textarea has content", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives: [] } }),
    } as Response);
    render(<SteerContent id="0" />);
    const textarea = screen.getByLabelText("New directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "do the thing" } });
    const button = screen.getByRole("button", { name: /Send Directive/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows success message and clears textarea after successful POST", async () => {
    mockFetchSequence([
      // initial GET
      { ok: true, json: async () => ({ data: { directives: [] } }) },
      // POST
      { ok: true, json: async () => ({ data: { success: true } }) },
      // refetch GET
      {
        ok: true,
        json: async () => ({ data: { directives: [makeDirective("focus (2026-04-25)")] } }),
      },
    ]);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No directives yet.")).toBeDefined();
    });

    const textarea = screen.getByLabelText("New directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "focus" } });
    const button = screen.getByRole("button", { name: /Send Directive/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Directive added.")).toBeDefined();
    });
    expect(textarea.value).toBe("");
    // List should refresh
    await waitFor(() => {
      expect(screen.getByText("focus")).toBeDefined();
    });
  });

  it("shows error message on failed POST", async () => {
    mockFetchSequence([
      { ok: true, json: async () => ({ data: { directives: [] } }) },
      { ok: false, json: async () => ({ error: "disk full" }) },
    ]);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No directives yet.")).toBeDefined();
    });

    const textarea = screen.getByLabelText("New directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "focus" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Directive/i }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeDefined();
    });
    // textarea should NOT be cleared on error
    expect(textarea.value).toBe("focus");
  });

  it("shows FetchError when initial GET fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "not found" }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load directives/i)).toBeDefined();
    });
  });

  it("shows FetchError on network failure during GET", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));
    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load directives/i)).toBeDefined();
    });
  });

  it("disables textarea while submitting", async () => {
    let resolvePost: ((v: Response) => void) | null = null;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { directives: [] } }),
    } as Response);
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolvePost = resolve;
      })
    );
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No directives yet.")).toBeDefined();
    });

    const textarea = screen.getByLabelText("New directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "focus" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Directive/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sending…/i })).toBeDefined();
    });
    expect(textarea.disabled).toBe(true);

    // Cleanup: resolve the pending POST
    if (resolvePost) {
      (resolvePost as (v: Response) => void)({
        ok: true,
        json: async () => ({ data: { success: true } }),
      } as Response);
    }
  });

  it("renders markdown formatting in directive text", async () => {
    const directives = [
      makeDirective(
        "Use **bold** and `code` plus a [link](https://example.com) and:\n- item one\n- item two (2026-04-25)"
      ),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    const { container } = render(<SteerContent id="0" />);
    await waitFor(() => {
      // <strong> wrapper from **bold** (only present after directives load)
      const strong = container.querySelector(".prose strong");
      expect(strong?.textContent).toBe("bold");
    });

    // Scope all markdown queries to the .prose container (directive row)
    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();

    // inline <code> from `code`
    const code = prose!.querySelector("code");
    expect(code?.textContent).toBe("code");

    // <a href> from markdown link
    const anchor = prose!.querySelector("a[href='https://example.com']");
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe("link");

    // list rendered as <ul><li>
    const items = prose!.querySelectorAll("ul li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe("item one");
    expect(items[1].textContent).toBe("item two");

    // Date badge still extracted from trailing parens
    expect(screen.getByText("2026-04-25")).toBeDefined();
  });

  it("does not submit when textarea is whitespace-only", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives: [] } }),
    } as Response);
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByText("No directives yet.")).toBeDefined();
    });

    const textarea = screen.getByLabelText("New directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "   \n  " } });
    const button = screen.getByRole("button", { name: /Send Directive/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    // Only the initial GET should have fired (no POST)
    const postCalls = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });
});
