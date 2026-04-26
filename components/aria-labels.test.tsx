import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { AddProjectDialog } from "./add-project-dialog";
import { AddTaskDialog } from "./add-task-dialog";
import { SteerDialog } from "./steer-dialog";
import { AnswerModal } from "./answer-modal";
import { OnboardingWizard } from "./onboarding-wizard";
import type { InboxQuestion } from "@/lib/redeye-types";

// next/navigation is used by AddProjectDialog
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("AddProjectDialog aria-labels (BL-024)", () => {
  it("Name input is labelled by the visible 'Name' label via htmlFor/id", () => {
    render(
      <AddProjectDialog open={true} onOpenChange={vi.fn()} onAdded={vi.fn()} />
    );
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.id).toBe("project-name");
  });

  it("Path input is labelled by the visible 'Path' label via htmlFor/id", () => {
    render(
      <AddProjectDialog open={true} onOpenChange={vi.fn()} onAdded={vi.fn()} />
    );
    const input = screen.getByLabelText("Path") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.id).toBe("project-path");
  });
});

describe("AddTaskDialog aria-labels (BL-024)", () => {
  it("title input is reachable via its 'Task title' aria-label", () => {
    render(
      <AddTaskDialog
        projectId={0}
        open={true}
        onOpenChange={vi.fn()}
        onAdded={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Task title") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.id).toBe("backlog-title");
  });
});

describe("SteerDialog aria-label (BL-024)", () => {
  it("textarea is reachable via 'Steering directive' aria-label", () => {
    render(
      <SteerDialog
        projectId={0}
        open={true}
        onOpenChange={vi.fn()}
        onSteered={vi.fn()}
      />
    );
    const textarea = screen.getByLabelText("Steering directive") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
  });
});

describe("AnswerModal aria-label (BL-024)", () => {
  it("textarea is reachable via 'Your answer' aria-label", () => {
    const question: InboxQuestion = {
      id: "Q-001",
      question: "Pick one?",
      answered: false,
    };
    render(
      <AnswerModal
        question={question}
        projectId={0}
        open={true}
        onOpenChange={vi.fn()}
        onAnswered={vi.fn()}
      />
    );
    const textarea = screen.getByLabelText("Your answer") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
  });
});

describe("OnboardingWizard Edit buttons aria-labels (BL-024)", () => {
  it("review-step Edit buttons each have a distinct aria-label", () => {
    // Render then walk to the review step. We mount the wizard, then click
    // through each Next button until we reach Review.
    const { container } = render(
      <OnboardingWizard
        projectId={0}
        projectName="demo"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Walk through the wizard until we reach the Review step. The "Next"
    // button's text content is "Next →" but the accessible name strips
    // whitespace inconsistently across renderers, so match by regex.
    const clickByText = (re: RegExp) => {
      const btns = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
      const btn = btns.find((b) => re.test(b.textContent ?? ""));
      if (!btn) throw new Error(`No button matching ${re}`);
      act(() => {
        fireEvent.click(btn);
      });
    };
    clickByText(/Get Started/);
    clickByText(/Next/);
    clickByText(/Next/);
    clickByText(/Next/);

    // Now on review step — three Edit buttons with distinct aria-labels
    expect(screen.getByRole("button", { name: "Edit vision" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit initial tasks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit commands" })).toBeTruthy();
    // Sanity — three distinct DOM nodes
    const editButtons = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Edit"
    );
    expect(editButtons.length).toBe(3);
  });
});
