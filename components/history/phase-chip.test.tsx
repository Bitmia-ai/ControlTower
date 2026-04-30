import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PhaseChip, PHASE_SHORT_LABELS } from "./phase-chip";

afterEach(() => {
  cleanup();
});

describe("PhaseChip", () => {
  it("renders the short label for a known phase", () => {
    render(<PhaseChip phase="BUILD" />);
    expect(screen.getByText(PHASE_SHORT_LABELS.BUILD)).toBeTruthy();
  });

  it("applies the PHASE_COLORS background class for known phase", () => {
    render(<PhaseChip phase="BUILD" />);
    const el = screen.getByTitle("BUILD");
    expect(el.className).toContain("bg-blue-100");
  });

  it("renders fallback gray classes for unknown phase", () => {
    render(<PhaseChip phase="UNKNOWN_PHASE" />);
    const el = screen.getByTitle("UNKNOWN_PHASE");
    expect(el.className).toContain("bg-gray-100");
    // Fallback short label = first 3 chars upper-case
    expect(screen.getByText("UNK")).toBeTruthy();
  });

  it("sets title attribute to the full phase name", () => {
    render(<PhaseChip phase="REVIEW" />);
    expect(screen.getByTitle("REVIEW")).toBeTruthy();
  });

  it("includes dark mode class via PHASE_COLORS", () => {
    render(<PhaseChip phase="DEPLOY" />);
    const el = screen.getByTitle("DEPLOY");
    expect(el.className).toMatch(/dark:bg-/);
  });
});
