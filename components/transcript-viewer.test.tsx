import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TranscriptViewer, findPrecedingToolName } from "./transcript-viewer";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";

afterEach(() => {
  cleanup();
});

describe("TranscriptViewer — ThinkingCard", () => {
  it("renders collapsed by default with preview text and expands on click", () => {
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "thinking",
      content:
        "The user wants to start the autonomous development loop and verify everything is working end-to-end.",
    };
    const { container } = render(<TranscriptViewer events={[event]} />);

    // Header label always visible
    expect(screen.getByText("Thinking…")).toBeTruthy();

    // Preview (truncated to <=80 chars + ellipsis) is visible in the collapsed header
    const previewSpan = container.querySelector("span.italic");
    expect(previewSpan).toBeTruthy();
    expect(previewSpan!.textContent).toContain("The user wants to start");

    // Full content is NOT yet present in an expanded panel — there is no
    // <p whitespace-pre-wrap> rendered for the body
    expect(container.querySelectorAll("p.whitespace-pre-wrap").length).toBe(0);

    // Click to expand
    const button = container.querySelector("button");
    expect(button).toBeTruthy();
    fireEvent.click(button!);

    // After click, the body paragraph appears with the full content
    const body = container.querySelector("p.whitespace-pre-wrap");
    expect(body).toBeTruthy();
    expect(body!.textContent).toContain("end-to-end");
  });

  it("respects forceExpanded=true and shows content without clicking", () => {
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "thinking",
      content: "Reasoning about the next step in the plan.",
    };
    const { container } = render(
      <TranscriptViewer events={[event]} forceExpanded={true} />
    );
    const body = container.querySelector("p.whitespace-pre-wrap");
    expect(body).toBeTruthy();
    expect(body!.textContent).toContain("Reasoning about the next step");
  });

  it("truncates long preview to 80 chars with an ellipsis", () => {
    const long =
      "x".repeat(120) + " trailing content that should not appear in the preview at all";
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "thinking",
      content: long,
    };
    const { container } = render(<TranscriptViewer events={[event]} />);
    const previewSpan = container.querySelector("span.italic");
    expect(previewSpan).toBeTruthy();
    // 80 char window + ellipsis character
    expect(previewSpan!.textContent!.length).toBeLessThanOrEqual(81);
    expect(previewSpan!.textContent).toContain("…");
  });
});

describe("TranscriptViewer — AssistantTextCard", () => {
  it("renders 'Claude' label and content with no collapse button", () => {
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "text",
      content: "Loop infrastructure is in place. Now invoking the skill.",
    };
    const { container } = render(<TranscriptViewer events={[event]} />);

    expect(screen.getByText("Claude")).toBeTruthy();
    expect(
      screen.getByText("Loop infrastructure is in place. Now invoking the skill.")
    ).toBeTruthy();

    // No collapse button (the only buttons in this view are toggles inside cards)
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("applies the red left-border accent class", () => {
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "text",
      content: "Hello.",
    };
    const { container } = render(<TranscriptViewer events={[event]} />);
    expect(container.querySelector(".border-l-red-500")).toBeTruthy();
  });
});

describe("TranscriptViewer — ToolUseCard (existing behavior)", () => {
  it("renders the tool name and tool_call label, expands on click", () => {
    const event: ClaudeStreamEvent = {
      type: "assistant",
      subtype: "tool_use",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
    };
    const { container } = render(<TranscriptViewer events={[event]} />);
    expect(screen.getByText("Bash")).toBeTruthy();
    expect(screen.getByText("tool call")).toBeTruthy();

    // Body collapsed
    expect(container.querySelector("pre")).toBeNull();

    fireEvent.click(container.querySelector("button")!);
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toContain("ls -la");
  });
});

describe("TranscriptViewer — ToolResultCard (existing behavior)", () => {
  it("renders preceding tool name as the result label and expands content", () => {
    const events: ClaudeStreamEvent[] = [
      {
        type: "assistant",
        subtype: "tool_use",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/foo" },
      },
      {
        type: "user",
        subtype: "tool_result",
        content: "file contents line 1\nfile contents line 2",
      },
    ];
    const { container } = render(<TranscriptViewer events={events} />);

    // The label "Read" appears twice — once as the tool_use name and once as
    // the result label.
    expect(screen.getAllByText("Read").length).toBe(2);
    expect(screen.getByText("result")).toBeTruthy();

    // Click the result row (second button) to expand
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    fireEvent.click(buttons[1]);
    expect(container.textContent).toContain("file contents line 1");
  });
});

describe("TranscriptViewer — plain user message suppression", () => {
  it("renders nothing for type:user with no subtype", () => {
    const event: ClaudeStreamEvent = {
      type: "user",
      content: "Long harness-injected user prompt that should be hidden.",
    };
    const { container } = render(<TranscriptViewer events={[event]} />);
    expect(container.textContent).not.toContain("Long harness-injected");
    // The flex container is the only DOM element — no event cards
    const flex = container.querySelector(".flex.flex-col.gap-3");
    expect(flex).toBeTruthy();
    expect(flex!.children.length).toBe(0);
  });

  it("renders only the tool_result when mixed with a plain user message", () => {
    const events: ClaudeStreamEvent[] = [
      { type: "user", content: "Initial harness prompt blob…" },
      { type: "user", subtype: "tool_result", content: "ok" },
    ];
    const { container } = render(<TranscriptViewer events={events} />);
    expect(container.textContent).not.toContain("Initial harness prompt blob");
    expect(screen.getByText("result")).toBeTruthy();
  });
});

describe("TranscriptViewer — session boundary separator", () => {
  it("renders a 'New session' separator for __session_boundary__", () => {
    const event = {
      type: "__session_boundary__",
    } as unknown as ClaudeStreamEvent;
    const { container } = render(<TranscriptViewer events={[event]} />);
    expect(container.textContent).toContain("New session");
  });
});

describe("findPrecedingToolName", () => {
  it("returns the nearest preceding assistant/tool_use tool name", () => {
    const events: ClaudeStreamEvent[] = [
      { type: "assistant", subtype: "text", content: "intro" },
      { type: "assistant", subtype: "tool_use", tool_name: "Bash", tool_input: {} },
      { type: "user", subtype: "tool_result", content: "result" },
    ];
    expect(findPrecedingToolName(events, 2)).toBe("Bash");
  });

  it("returns null when an intervening tool_result blocks the lookup", () => {
    const events: ClaudeStreamEvent[] = [
      { type: "assistant", subtype: "tool_use", tool_name: "Bash", tool_input: {} },
      { type: "user", subtype: "tool_result", content: "first" },
      { type: "user", subtype: "tool_result", content: "second" },
    ];
    expect(findPrecedingToolName(events, 2)).toBeNull();
  });

  it("returns null when no preceding tool_use exists", () => {
    const events: ClaudeStreamEvent[] = [
      { type: "user", subtype: "tool_result", content: "orphan" },
    ];
    expect(findPrecedingToolName(events, 0)).toBeNull();
  });
});
