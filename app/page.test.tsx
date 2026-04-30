import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import Home, { metadata } from "./page";

// Mock child components to keep the test surface tight. The real ProjectCardNew,
// FleetSummary, InboxCard, and dialogs each have their own tests; here we only
// verify the home shell.
vi.mock("@/components/redesign/project-card-new", () => ({
  ProjectCardNew: () => null,
}));
vi.mock("@/components/redesign/fleet-summary", () => ({
  FleetSummary: () => null,
}));
vi.mock("@/components/redesign/inbox-card", () => ({
  InboxCard: () => null,
}));
vi.mock("@/components/add-project-dialog", () => ({
  AddProjectDialog: () => null,
}));
vi.mock("@/components/add-task-dialog", () => ({
  AddTaskDialog: () => null,
}));
vi.mock("@/components/steer-dialog", () => ({
  SteerDialog: () => null,
}));
vi.mock("@/components/answer-modal", () => ({
  AnswerModal: () => null,
}));
vi.mock("@/components/empty-state", () => ({
  EmptyState: () => null,
}));
vi.mock("@/components/fetch-error", () => ({
  FetchError: () => null,
}));
vi.mock("@/components/home-onboarding-wizard", () => ({
  HomeOnboardingWizard: () => null,
}));
vi.mock("@/components/install-banner", () => ({
  InstallBanner: () => null,
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

describe("Home page header", () => {
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

  it("renders an h1 heading", async () => {
    const { container } = render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const h1 = container.querySelector("h1");
    expect(h1).toBeTruthy();
    // With zero projects the heading is the welcome string.
    expect(h1?.textContent).toBe("Welcome");
  });

  it("renders an Add project button", async () => {
    const { container } = render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const buttons = Array.from(container.querySelectorAll("button"));
    const addBtn = buttons.find((b) => /add project/i.test(b.textContent ?? ""));
    expect(addBtn).toBeTruthy();
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
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const mountCalls = fetchMock.mock.calls.length;
    expect(mountCalls).toBeGreaterThanOrEqual(1);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    // Each refresh hits both /api/projects and /api/inbox so call count grows
    // by 2 per tick.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(mountCalls);

    const afterFirstTick = fetchMock.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirstTick);
  });

  it("stops polling when tab is hidden", async () => {
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const beforeHide = fetchMock.mock.calls.length;

    setVisibility("hidden");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });

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

    setVisibility("visible");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(beforeShow);
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

    expect(
      removeSpy.mock.calls.some((c) => c[0] === "visibilitychange")
    ).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeUnmount);

    setVisibility("visible");
    await act(async () => {
      dispatchVisibilityChange();
      await Promise.resolve();
    });
    expect(fetchMock.mock.calls.length).toBe(beforeUnmount);
  });
});
