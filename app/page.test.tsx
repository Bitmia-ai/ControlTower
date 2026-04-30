import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import Home, { metadata } from "./page";

// Mock child components to keep test surface tight
vi.mock("@/components/project-card", () => ({
  ProjectCard: () => null,
}));
vi.mock("@/components/add-project-dialog", () => ({
  AddProjectDialog: () => null,
}));
vi.mock("@/components/empty-state", () => ({
  EmptyState: () => null,
}));
vi.mock("@/components/fetch-error", () => ({
  FetchError: () => null,
}));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function dispatchVisibilityChange() {
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("Home page metadata (T077)", () => {
  it("exports metadata with title 'Projects'", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("Projects");
  });
});

describe("Home page header (T066)", () => {
  beforeEach(() => {
    setVisibility("visible");
    // @ts-expect-error mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders Control Tower eyebrow label, Projects h1, and border-b divider", async () => {
    const { container } = render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Control Tower");
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("Projects");
    // Header should have border-b divider
    const header = container.querySelector("header");
    expect(header).toBeTruthy();
    expect(header?.className).toMatch(/border-b/);
    // Eyebrow should be monospace
    const eyebrow = Array.from(container.querySelectorAll("p")).find(
      (p) => p.textContent === "Control Tower"
    );
    expect(eyebrow?.className).toMatch(/font-mono/);
  });

  it("renders project count subtitle", async () => {
    const { container } = render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("0 projects registered");
  });
});

describe("Home page visibility-aware polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    // @ts-expect-error mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
  });

  it("fetches on mount and continues polling at 10s intervals while visible", async () => {
    render(<Home />);
    // Allow mount-time fetch microtasks to flush
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const mountCalls = fetchMock.mock.calls.length;
    expect(mountCalls).toBeGreaterThanOrEqual(1);

    // Advance 10s -> one more poll
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(mountCalls + 1);

    // Advance another 10s -> another poll
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(mountCalls + 2);
  });

  it("stops polling when tab is hidden", async () => {
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const beforeHide = fetchMock.mock.calls.length;

    // Hide the tab
    setVisibility("hidden");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });

    // Advance 30s — no additional fetches should happen
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeHide);
  });

  it("immediately fetches and resumes polling when tab becomes visible again", async () => {
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    // Hide
    setVisibility("hidden");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(20_000);
      await Promise.resolve();
    });
    const beforeShow = fetchMock.mock.calls.length;

    // Show — should trigger immediate fetch
    setVisibility("visible");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeShow + 1);

    // Polling resumes — advance 10s -> one more
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeShow + 2);
  });

  it("cleans up interval and event listener on unmount", async () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const beforeUnmount = fetchMock.mock.calls.length;

    unmount();

    // visibilitychange listener should be removed
    expect(
      removeSpy.mock.calls.some((c) => c[0] === "visibilitychange")
    ).toBe(true);

    // Advance time — no additional fetches
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeUnmount);

    // No additional fetches even after firing visibility events
    setVisibility("visible");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeUnmount);
  });
});
