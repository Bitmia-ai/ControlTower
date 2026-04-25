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

  it("renders edit and delete buttons for each directive row", async () => {
    const directives = [
      makeDirective("First directive (2026-04-25)"),
      makeDirective("Second directive (2026-04-24)"),
    ];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
      expect(screen.getByLabelText("Delete directive 1")).toBeDefined();
      expect(screen.getByLabelText("Edit directive 2")).toBeDefined();
      expect(screen.getByLabelText("Delete directive 2")).toBeDefined();
    });
  });

  it("delete flow: clicking trash shows confirm panel; cancel restores view", async () => {
    const directives = [makeDirective("only one (2026-04-25)")];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Delete directive 1")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Delete directive 1"));
    expect(screen.getByText("Delete this directive?")).toBeDefined();
    expect(screen.getByRole("button", { name: /^Delete$/ })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(screen.queryByText("Delete this directive?")).toBeNull();
  });

  it("delete flow: confirm fires DELETE with correct payload and refetches", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          directives: [
            makeDirective("first (2026-04-25)"),
            makeDirective("second (2026-04-25)"),
          ],
        },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("first (2026-04-25)")] },
      }),
    });
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Delete directive 2")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Delete directive 2"));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    const deleteCall = fetchMock.mock.calls[1];
    expect(deleteCall[0]).toBe("/api/projects/0/steer");
    expect((deleteCall[1] as RequestInit).method).toBe("DELETE");
    const deleteBody = JSON.parse((deleteCall[1] as RequestInit).body as string);
    expect(deleteBody).toEqual({ index: 1 });

    await waitFor(() => {
      expect(screen.queryByText("second")).toBeNull();
      expect(screen.getByText("first")).toBeDefined();
    });
  });

  it("delete flow: shows inline error on failed DELETE", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("only (2026-04-25)")] },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "out of range" }),
    });
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Delete directive 1")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Delete directive 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(screen.getByText("out of range")).toBeDefined();
    });
    // Confirm panel is still visible
    expect(screen.getByText("Delete this directive?")).toBeDefined();
  });

  it("edit flow: pencil opens textarea pre-filled with directive source", async () => {
    const directives = [makeDirective("Hello **world** (2026-04-25)")];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Edit directive 1"));
    const textarea = screen.getByLabelText("Edit directive") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Hello **world** (2026-04-25)");
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeDefined();
  });

  it("edit flow: cancel restores view without firing PATCH", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("orig (2026-04-25)")] },
      }),
    });
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText("Edit directive 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));

    expect(screen.queryByLabelText("Edit directive")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only initial GET
  });

  it("edit flow: save fires PATCH with correct payload and refetches", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("orig (2026-04-25)")] },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("edited (2026-04-25)")] },
      }),
    });
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Edit directive 1"));
    const textarea = screen.getByLabelText("Edit directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "edited (2026-04-25)" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[0]).toBe("/api/projects/0/steer");
    expect((patchCall[1] as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((patchCall[1] as RequestInit).body as string);
    expect(body).toEqual({ index: 0, text: "edited (2026-04-25)" });

    await waitFor(() => {
      expect(screen.getByText("edited")).toBeDefined();
    });
  });

  it("edit flow: shows inline error and keeps editor open on PATCH failure", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { directives: [makeDirective("orig (2026-04-25)")] },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "disk full" }),
    });
    vi.spyOn(global, "fetch").mockImplementation(fetchMock);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Edit directive 1"));
    const textarea = screen.getByLabelText("Edit directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => {
      expect(screen.getByText("disk full")).toBeDefined();
    });
    // Editor still open
    expect(screen.getByLabelText("Edit directive")).toBeDefined();
  });

  it("edit flow: save button disabled when textarea is empty", async () => {
    const directives = [makeDirective("orig (2026-04-25)")];
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { directives } }),
    } as Response);

    render(<SteerContent id="0" />);
    await waitFor(() => {
      expect(screen.getByLabelText("Edit directive 1")).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText("Edit directive 1"));
    const textarea = screen.getByLabelText("Edit directive") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "   " } });
    const save = screen.getByRole("button", { name: /^Save$/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
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
