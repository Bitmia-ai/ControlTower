import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";
import { TranscriptViewer, findPrecedingToolName } from "../transcript-viewer";

afterEach(() => cleanup());

function toolUse(name: string, input: Record<string, unknown> = {}): ClaudeStreamEvent {
  return { type: "assistant", subtype: "tool_use", tool_name: name, tool_input: input };
}
function toolResult(content: string): ClaudeStreamEvent {
  return { type: "user", subtype: "tool_result", content };
}
function assistantText(content: string): ClaudeStreamEvent {
  return { type: "assistant", subtype: "text", content };
}

describe("findPrecedingToolName", () => {
  it("returns the tool name of the immediately preceding tool_use", () => {
    const events: ClaudeStreamEvent[] = [toolUse("Bash", { command: "ls" }), toolResult("file")];
    expect(findPrecedingToolName(events, 1)).toBe("Bash");
  });

  it("returns null when there is no preceding tool_use", () => {
    const events: ClaudeStreamEvent[] = [assistantText("hello"), toolResult("out")];
    expect(findPrecedingToolName(events, 1)).toBeNull();
  });

  it("returns null when another tool_result intervenes (pairing belongs elsewhere)", () => {
    const events: ClaudeStreamEvent[] = [
      toolUse("Read", {}),
      toolResult("first output"),
      toolResult("second output"),
    ];
    expect(findPrecedingToolName(events, 2)).toBeNull();
  });

  it("skips text/thinking events to find the tool_use", () => {
    const events: ClaudeStreamEvent[] = [
      toolUse("Grep", {}),
      assistantText("commentary"),
      toolResult("grep output"),
    ];
    expect(findPrecedingToolName(events, 2)).toBe("Grep");
  });

  it("returns null when index is 0", () => {
    const events: ClaudeStreamEvent[] = [toolResult("orphan")];
    expect(findPrecedingToolName(events, 0)).toBeNull();
  });
});

describe("ToolResultCard (via TranscriptViewer)", () => {
  it("renders tool_result collapsed by default (body <pre> not in DOM)", () => {
    // Multi-line content: preview shows line 1 in header, full body (line 2)
    // only appears in the <pre> when expanded.
    const events = [
      toolUse("Bash", { command: "echo hi" }),
      toolResult("preview line\nFULL_ONLY_LINE_XYZ"),
    ];
    const { container } = render(<TranscriptViewer events={events} />);
    // No <pre> rendered when collapsed
    expect(container.querySelector("pre")).toBeNull();
    // And the body-only line is absent
    expect(screen.queryByText(/FULL_ONLY_LINE_XYZ/)).toBeNull();
  });

  it("shows full body content after clicking the header", () => {
    const events = [
      toolUse("Bash", {}),
      toolResult("preview line\nEXPANDED_BODY_LINE_Q"),
    ];
    render(<TranscriptViewer events={events} />);
    const headers = screen.getAllByRole("button");
    // Click the tool_result header (second button)
    fireEvent.click(headers[1]);
    expect(screen.getByText(/EXPANDED_BODY_LINE_Q/)).toBeTruthy();
  });

  it("uses tool name from preceding tool_use as label when available", () => {
    const events = [toolUse("Grep", {}), toolResult("match line 1\nmatch line 2")];
    render(<TranscriptViewer events={events} />);
    // Both cards show "Grep" label — there are two matches
    const labels = screen.getAllByText("Grep");
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to 'tool result' when no preceding tool_use", () => {
    const events = [toolResult("orphan content")];
    render(<TranscriptViewer events={events} />);
    expect(screen.getByText("tool result")).toBeTruthy();
  });

  it("shows preview (first non-empty line) in header", () => {
    const events = [toolResult("\n\nhello preview line\nmore body")];
    render(<TranscriptViewer events={events} />);
    expect(screen.getByText(/hello preview line/)).toBeTruthy();
  });
});

describe("TranscriptViewer forceExpanded prop", () => {
  it("when forceExpanded=true, tool_use bodies are visible in initial DOM", () => {
    const events = [toolUse("Bash", { command: "marker_cmd_A" })];
    render(<TranscriptViewer events={events} forceExpanded={true} />);
    expect(screen.getByText(/marker_cmd_A/)).toBeTruthy();
  });

  it("when forceExpanded=true, tool_result bodies are visible in initial DOM", () => {
    // Use multi-line content so the 'full body' line (B) is distinct from the preview line
    const events = [toolUse("Bash", {}), toolResult("preview\nmarker_result_body_B")];
    render(<TranscriptViewer events={events} forceExpanded={true} />);
    expect(screen.getByText(/marker_result_body_B/)).toBeTruthy();
  });

  it("when forceExpanded=false, tool bodies (<pre>) are hidden", () => {
    const events = [
      toolUse("Bash", { command: "marker_cmd_C" }),
      toolResult("preview line\nmarker_result_D"),
    ];
    const { container } = render(
      <TranscriptViewer events={events} forceExpanded={false} />
    );
    // No <pre> elements in the DOM when all folded
    expect(container.querySelectorAll("pre").length).toBe(0);
    expect(screen.queryByText(/marker_cmd_C/)).toBeNull();
    expect(screen.queryByText(/marker_result_D/)).toBeNull();
  });
});

describe("useOpenState lifecycle (T048)", () => {
  function thinking(content: string): ClaudeStreamEvent {
    return { type: "assistant", subtype: "thinking", content };
  }

  it("ToolResultCard: initial render with forceExpanded=null is collapsed", () => {
    const events = [
      toolUse("Bash", {}),
      toolResult("preview\nLIFECYCLE_BODY_INIT_R"),
    ];
    const { container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/LIFECYCLE_BODY_INIT_R/)).toBeNull();
  });

  it("ToolResultCard: manually opened, then forceExpanded=false collapses, then null keeps it collapsed", () => {
    const events = [
      toolUse("Bash", {}),
      toolResult("preview\nLIFECYCLE_BODY_R1"),
    ];
    const { rerender, container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    // Open manually — the tool_result header is the second button.
    const headers = screen.getAllByRole("button");
    fireEvent.click(headers[1]);
    expect(screen.getByText(/LIFECYCLE_BODY_R1/)).toBeTruthy();

    // Collapse All
    rerender(<TranscriptViewer events={events} forceExpanded={false} />);
    expect(screen.queryByText(/LIFECYCLE_BODY_R1/)).toBeNull();

    // Return to per-card mode — must stay collapsed
    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/LIFECYCLE_BODY_R1/)).toBeNull();
  });

  it("ToolResultCard: closed, then forceExpanded=true opens, then null keeps it open", () => {
    const events = [
      toolUse("Bash", {}),
      toolResult("preview\nLIFECYCLE_BODY_R2"),
    ];
    const { rerender } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    expect(screen.queryByText(/LIFECYCLE_BODY_R2/)).toBeNull();

    rerender(<TranscriptViewer events={events} forceExpanded={true} />);
    expect(screen.getByText(/LIFECYCLE_BODY_R2/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(screen.getByText(/LIFECYCLE_BODY_R2/)).toBeTruthy();
  });

  it("ToolUseCard: initial render with forceExpanded=null is collapsed", () => {
    const events = [toolUse("Bash", { command: "LIFECYCLE_TU_INIT" })];
    const { container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/LIFECYCLE_TU_INIT/)).toBeNull();
  });

  it("ToolUseCard: manually opened, then forceExpanded=false then null stays collapsed", () => {
    const events = [toolUse("Bash", { command: "LIFECYCLE_TU_BODY1" })];
    const { rerender, container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    const headers = screen.getAllByRole("button");
    fireEvent.click(headers[0]);
    expect(screen.getByText(/LIFECYCLE_TU_BODY1/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={false} />);
    expect(screen.queryByText(/LIFECYCLE_TU_BODY1/)).toBeNull();

    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/LIFECYCLE_TU_BODY1/)).toBeNull();
  });

  it("ToolUseCard: closed, then forceExpanded=true then null stays open", () => {
    const events = [toolUse("Bash", { command: "LIFECYCLE_TU_BODY2" })];
    const { rerender } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    expect(screen.queryByText(/LIFECYCLE_TU_BODY2/)).toBeNull();

    rerender(<TranscriptViewer events={events} forceExpanded={true} />);
    expect(screen.getByText(/LIFECYCLE_TU_BODY2/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(screen.getByText(/LIFECYCLE_TU_BODY2/)).toBeTruthy();
  });

  it("ThinkingCard: initial render with forceExpanded=null is collapsed", () => {
    const events = [thinking("first preview\nLIFECYCLE_TH_INIT_BODY")];
    const { container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    // The body uses <p whitespace-pre-wrap>, not <pre>
    expect(container.querySelectorAll("p.whitespace-pre-wrap").length).toBe(0);
    // The body-only line should not be present
    const bodyMatches = screen.queryAllByText(/LIFECYCLE_TH_INIT_BODY/);
    // The preview span shows truncated first line, so body-only line must be absent
    expect(bodyMatches.length).toBe(0);
  });

  it("ThinkingCard: manually opened, then forceExpanded=false then null stays collapsed", () => {
    const events = [thinking("preview line\nLIFECYCLE_TH_BODY1")];
    const { rerender, container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText(/LIFECYCLE_TH_BODY1/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={false} />);
    expect(screen.queryByText(/LIFECYCLE_TH_BODY1/)).toBeNull();

    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(container.querySelectorAll("p.whitespace-pre-wrap").length).toBe(0);
    expect(screen.queryByText(/LIFECYCLE_TH_BODY1/)).toBeNull();
  });

  it("ThinkingCard: closed, then forceExpanded=true then null stays open", () => {
    const events = [thinking("preview\nLIFECYCLE_TH_BODY2")];
    const { rerender } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    expect(screen.queryByText(/LIFECYCLE_TH_BODY2/)).toBeNull();

    rerender(<TranscriptViewer events={events} forceExpanded={true} />);
    expect(screen.getByText(/LIFECYCLE_TH_BODY2/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={null} />);
    expect(screen.getByText(/LIFECYCLE_TH_BODY2/)).toBeTruthy();
  });

  it("Expand all then Collapse All collapses an opened card immediately", () => {
    const events = [
      toolUse("Bash", {}),
      toolResult("preview\nLIFECYCLE_BODY_COLLAPSE_ALL"),
    ];
    const { rerender, container } = render(
      <TranscriptViewer events={events} forceExpanded={null} />
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(screen.getByText(/LIFECYCLE_BODY_COLLAPSE_ALL/)).toBeTruthy();

    rerender(<TranscriptViewer events={events} forceExpanded={false} />);
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByText(/LIFECYCLE_BODY_COLLAPSE_ALL/)).toBeNull();
  });
});

describe("TranscriptViewer non-tool events", () => {
  it("renders assistant text in full", () => {
    const events = [assistantText("Claude explains something important")];
    render(<TranscriptViewer events={events} />);
    expect(screen.getByText("Claude explains something important")).toBeTruthy();
  });

  it("suppresses plain user messages (no tool_result subtype) — T040 T3", () => {
    // The harness-injected initial user prompt should not pollute the Live tab.
    // Only user/tool_result events render via ToolResultCard.
    const events: ClaudeStreamEvent[] = [{ type: "user", content: "plain user msg" }];
    const { container } = render(<TranscriptViewer events={events} />);
    expect(screen.queryByText("plain user msg")).toBeNull();
    // The flex container exists but has no event children
    const flex = container.querySelector(".flex.flex-col.gap-3");
    expect(flex).toBeTruthy();
    expect(flex!.children.length).toBe(0);
  });
});
