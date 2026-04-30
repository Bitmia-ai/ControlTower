import { describe, it, expect } from "vitest";
import { appendCeoTask, type TaskSpec } from "./tasks-writer";

const baseTask: TaskSpec = {
  id: "T042",
  title: "Improve onboarding",
  type: "feature",
  priority: "P1",
  status: "pending",
};

describe("appendCeoTask", () => {
  it("inserts a new block immediately after '## CEO Requests' header", () => {
    const content = "# Tasks\n\n## CEO Requests\n\n## Done\n";
    const out = appendCeoTask(content, baseTask);
    // Header preserved, new block sits between header and Done section
    expect(out.startsWith("# Tasks\n\n## CEO Requests\n")).toBe(true);
    expect(out).toContain(
      "## CEO Requests\n\n### T042: Improve onboarding\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n"
    );
    expect(out).toContain("\n## Done\n");
    expect(out.indexOf("### T042")).toBeLessThan(out.indexOf("## Done"));
  });

  it("inserts new item before existing items under header (top-insertion)", () => {
    const content =
      "# Tasks\n\n## CEO Requests\n\n### T040: Old item\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n";
    const out = appendCeoTask(content, baseTask);
    const newIdx = out.indexOf("### T042");
    const oldIdx = out.indexOf("### T040");
    expect(newIdx).toBeGreaterThan(-1);
    expect(oldIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeLessThan(oldIdx);
    // Old item still present and unmodified
    expect(out).toContain(
      "### T040: Old item\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n"
    );
  });

  it("creates a '## CEO Requests' section when header absent", () => {
    const content = "# Tasks\n\n## Done\n";
    const out = appendCeoTask(content, baseTask);
    expect(out).toContain("## CEO Requests");
    expect(out).toContain(
      "### T042: Improve onboarding\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n"
    );
    // Original Done section preserved
    expect(out).toContain("## Done\n");
  });

  it("renders description line when description present", () => {
    const out = appendCeoTask("## CEO Requests\n", {
      ...baseTask,
      description: "Make the form snappier",
    });
    expect(out).toContain("- **Description:** Make the form snappier\n");
  });

  it("omits description line when description absent", () => {
    const out = appendCeoTask("## CEO Requests\n", baseTask);
    expect(out).not.toContain("- **Description:**");
  });

  it("omits description line when description is empty string", () => {
    const out = appendCeoTask("## CEO Requests\n", { ...baseTask, description: "" });
    expect(out).not.toContain("- **Description:**");
  });

  it("renders schedule line when schedule present", () => {
    const out = appendCeoTask("## CEO Requests\n", {
      ...baseTask,
      type: "scheduled",
      schedule: "SCHED-3",
    });
    expect(out).toContain("- **Schedule:** SCHED-3\n");
  });

  it("omits schedule line when schedule absent", () => {
    const out = appendCeoTask("## CEO Requests\n", baseTask);
    expect(out).not.toContain("- **Schedule:**");
  });

  it("renders both description and schedule when both present", () => {
    const out = appendCeoTask("## CEO Requests\n", {
      ...baseTask,
      description: "Run the audit",
      schedule: "SCHED-3",
    });
    expect(out).toContain("- **Description:** Run the audit\n");
    expect(out).toContain("- **Schedule:** SCHED-3\n");
    // Order: description before schedule (only if both present)
    expect(out.indexOf("- **Description:**")).toBeLessThan(
      out.indexOf("- **Schedule:**")
    );
  });

  it("handles empty string content by creating header section", () => {
    const out = appendCeoTask("", baseTask);
    expect(out).toContain("## CEO Requests");
    expect(out).toContain(
      "### T042: Improve onboarding\n- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n"
    );
  });

  it("handles content with header but no trailing newline gracefully", () => {
    // Edge case: '## CEO Requests' is the very last line, no '\n' after it
    const content = "# Tasks\n\n## CEO Requests";
    const out = appendCeoTask(content, baseTask);
    // Header preserved + new block appears after it
    expect(out).toContain("## CEO Requests");
    expect(out).toContain("### T042: Improve onboarding");
    expect(out).toContain("- **Type:** feature\n- **Priority:** P1\n- **Status:** pending\n");
  });

  it("respects type field — uses 'scheduled' verbatim", () => {
    const out = appendCeoTask("## CEO Requests\n", {
      id: "T100",
      title: "Run schedule: Security audit",
      type: "scheduled",
      priority: "P1",
      status: "pending",
      schedule: "SCHED-3",
    });
    expect(out).toContain("- **Type:** scheduled\n");
    expect(out).toContain("### T100: Run schedule: Security audit\n");
  });

  it("preserves existing content verbatim outside the insertion point", () => {
    const content =
      "# Tasks\n\nIntro paragraph.\n\n## CEO Requests\n\n### T001: keep me\n- **Type:** feature\n\n## Done\n\n### T000: archived\n";
    const out = appendCeoTask(content, baseTask);
    expect(out).toContain("Intro paragraph.\n");
    expect(out).toContain("### T001: keep me\n- **Type:** feature\n");
    expect(out).toContain("## Done\n\n### T000: archived\n");
  });

  it("uses pure-function semantics — no I/O, returns new string without mutating input", () => {
    const original = "# Tasks\n\n## CEO Requests\n";
    const snapshot = original;
    const out = appendCeoTask(original, baseTask);
    expect(original).toBe(snapshot);
    expect(out).not.toBe(original);
  });
});
