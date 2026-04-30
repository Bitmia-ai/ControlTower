import { describe, it, expect } from "vitest";
import {
  PHASE_LABELS,
  PHASE_COLORS,
  normalizePhase,
  getPhaseLabel,
  getPhaseColors,
} from "./redeye-types";

describe("normalizePhase", () => {
  it("uppercases lower-case phases", () => {
    expect(normalizePhase("build")).toBe("BUILD");
    expect(normalizePhase("triage")).toBe("TRIAGE");
  });

  it("returns upper-case phases unchanged", () => {
    expect(normalizePhase("BUILD")).toBe("BUILD");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizePhase("  deploy  ")).toBe("DEPLOY");
  });

  it("returns empty string for null/undefined/empty input", () => {
    expect(normalizePhase(null)).toBe("");
    expect(normalizePhase(undefined)).toBe("");
    expect(normalizePhase("")).toBe("");
  });
});

describe("getPhaseLabel", () => {
  it("returns the canonical label for a known lowercase phase", () => {
    expect(getPhaseLabel("build")).toBe(PHASE_LABELS.BUILD);
    expect(getPhaseLabel("BUILD")).toBe(PHASE_LABELS.BUILD);
  });

  it("returns the canonical label for every defined phase regardless of case", () => {
    for (const key of Object.keys(PHASE_LABELS)) {
      expect(getPhaseLabel(key.toLowerCase())).toBe(PHASE_LABELS[key]);
    }
  });

  it("falls back to the upper-cased phase string for unknown phases", () => {
    expect(getPhaseLabel("custom-phase")).toBe("CUSTOM-PHASE");
  });

  it("returns empty string when phase is null/undefined", () => {
    expect(getPhaseLabel(null)).toBe("");
    expect(getPhaseLabel(undefined)).toBe("");
  });
});

describe("getPhaseColors", () => {
  it("returns colors for a lowercase phase key", () => {
    expect(getPhaseColors("build")).toBe(PHASE_COLORS.BUILD);
  });

  it("returns colors for an uppercase phase key", () => {
    expect(getPhaseColors("DEPLOY")).toBe(PHASE_COLORS.DEPLOY);
  });

  it("returns undefined for an unknown phase", () => {
    expect(getPhaseColors("nonsense")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(getPhaseColors(null)).toBeUndefined();
    expect(getPhaseColors(undefined)).toBeUndefined();
  });
});
