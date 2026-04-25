import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QuestionsCard } from "./questions-card";
import type { InboxQuestion } from "@/lib/redeye-types";

afterEach(() => {
  cleanup();
});

function makeQuestion(overrides: Partial<InboxQuestion> = {}): InboxQuestion {
  return {
    id: "Q-001",
    question: "Should we ship?",
    context: "Pre-flight check",
    options: [],
    answered: false,
    ...overrides,
  } as InboxQuestion;
}

describe("QuestionsCard — empty state (BL-067 strip)", () => {
  it("renders compact strip (not full card) when no pending questions", () => {
    const { container } = render(<QuestionsCard questions={[]} />);
    // Strip uses px-4 py-2.5 rounded-md, not p-5 rounded-lg
    const strip = container.querySelector(".px-4.py-2\\.5.rounded-md");
    expect(strip).toBeTruthy();
    // No card eyebrow label "Questions" when empty
    expect(container.textContent).not.toContain("Questions");
    expect(container.textContent).toContain("No pending questions");
  });

  it("does not render the red border-t accent when empty", () => {
    const { container } = render(<QuestionsCard questions={[]} />);
    expect(container.querySelector(".border-t-red-500")).toBeNull();
  });

  it("treats already-answered questions as empty", () => {
    const answered = makeQuestion({ answered: true });
    const { container } = render(<QuestionsCard questions={[answered]} />);
    expect(container.textContent).toContain("No pending questions");
    expect(container.querySelector(".border-t-red-500")).toBeNull();
  });
});

describe("QuestionsCard — pending state (full card unchanged)", () => {
  it("renders full card with red border-t when pending question exists", () => {
    const q = makeQuestion();
    const { container } = render(<QuestionsCard questions={[q]} />);
    expect(container.querySelector(".border-t-red-500")).toBeTruthy();
    expect(screen.getByText("Should we ship?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Answer/ })).toBeTruthy();
  });

  it("renders count badge when multiple pending questions", () => {
    const qs = [
      makeQuestion({ id: "Q-001" }),
      makeQuestion({ id: "Q-002", question: "Q2" }),
      makeQuestion({ id: "Q-003", question: "Q3" }),
    ];
    const { container } = render(<QuestionsCard questions={qs} />);
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("+2 more");
  });
});
