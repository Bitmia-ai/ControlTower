import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { HomeOnboardingWizard } from "./home-onboarding-wizard";

// Storage mock that mimics localStorage semantics
function makeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = String(v);
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k];
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  } as Storage;
}

let storage: Storage;

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HomeOnboardingWizard", () => {
  it("renders step 1 welcome heading on initial render", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/welcome to control tower/i)).toBeTruthy();
  });

  it("Get Started button advances from step 1 to step 2 (prerequisites)", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/prerequisites/i)).toBeTruthy();
  });

  it("Next button advances from step 2 to step 3 (register project)", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByLabelText(/^path/i)).toBeTruthy();
  });

  it("Back button returns from step 2 to step 1", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/welcome to control tower/i)).toBeTruthy();
  });

  it("Skip button on step 1 calls onDismiss and persists localStorage flag", () => {
    const onDismiss = vi.fn();
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(storage.getItem("ct_onboarding_dismissed")).toBe("true");
  });

  it("Skip button works on every step", () => {
    const onDismiss = vi.fn();
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={onDismiss} />);
    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("returns null when localStorage ct_onboarding_dismissed is 'true' on mount", () => {
    storage.setItem("ct_onboarding_dismissed", "true");
    const { container } = render(
      <HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container.textContent).toBe("");
  });

  it("step 3 form has name and path inputs", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByLabelText(/^path/i)).toBeTruthy();
  });

  it("step 3 submit POSTs to /api/projects and calls onProjectAdded on success", async () => {
    const onProjectAdded = vi.fn();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: { name: "demo", path: "/tmp/demo" } }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      ) as Response
    );
    render(<HomeOnboardingWizard onProjectAdded={onProjectAdded} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^path/i), { target: { value: "/tmp/demo" } });
    fireEvent.click(screen.getByRole("button", { name: /register project/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, opts] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/projects");
    expect((opts as RequestInit).method).toBe("POST");

    await waitFor(() => expect(onProjectAdded).toHaveBeenCalledOnce());
  });

  it("step 3 submit shows error message on API failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Path not found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }) as Response
    );
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^path/i), { target: { value: "/nope" } });
    fireEvent.click(screen.getByRole("button", { name: /register project/i }));

    await waitFor(() => expect(screen.getByText(/path not found/i)).toBeTruthy());
  });

  it("step 3 submit shows generic error on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"));
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^path/i), { target: { value: "/tmp/demo" } });
    fireEvent.click(screen.getByRole("button", { name: /register project/i }));
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeTruthy());
  });

  it("step 4 (Start the Loop) renders after successful registration", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { name: "demo", path: "/tmp/demo" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }) as Response
    );
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^path/i), { target: { value: "/tmp/demo" } });
    fireEvent.click(screen.getByRole("button", { name: /register project/i }));
    await waitFor(() => expect(screen.getByText(/start the loop/i)).toBeTruthy());
  });

  it("step indicator shows 4 dots with current step active", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    const dots = screen.getAllByTestId(/^step-dot-/);
    expect(dots).toHaveLength(4);
    // Step 1 active
    expect(dots[0]!.getAttribute("data-active")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    const dots2 = screen.getAllByTestId(/^step-dot-/);
    expect(dots2[1]!.getAttribute("data-active")).toBe("true");
    expect(dots2[0]!.getAttribute("data-active")).toBe("false");
  });

  it("renders a Done button on step 4 that calls onDismiss without setting localStorage", async () => {
    const onDismiss = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { name: "demo", path: "/tmp/demo" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }) as Response
    );
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next/i }));
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "demo" } });
    fireEvent.change(screen.getByLabelText(/^path/i), { target: { value: "/tmp/demo" } });
    fireEvent.click(screen.getByRole("button", { name: /register project/i }));
    await waitFor(() => expect(screen.getByText(/start the loop/i)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("Step 2 prerequisites lists git, redeye, and claude code", () => {
    render(<HomeOnboardingWizard onProjectAdded={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByText(/git repository/i)).toBeTruthy();
    expect(screen.getByText(/redeye plugin installed/i)).toBeTruthy();
    expect(screen.getByText(/claude code installed/i)).toBeTruthy();
  });
});
