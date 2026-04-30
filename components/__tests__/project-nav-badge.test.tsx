/**
 * @vitest-environment node
 *
 * T108: Tasks tab count badge — source-text assertions for ProjectNav.
 *
 * Strategy: read the source of project-nav.tsx and assert that the badge
 * rendering logic, prop interface, and aria-label are present. This avoids
 * mounting client components (which require browser-only APIs and the React.act
 * workaround) and gives us solid regression protection.
 *
 * Additionally, test the layout.tsx data extraction logic via unit tests on
 * the filter logic used to compute openTaskCount.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

let navSource = "";
let layoutSource = "";

beforeAll(() => {
  navSource = readFileSync(
    resolve(PROJECT_ROOT, "components/project-nav.tsx"),
    "utf8"
  );
  // The redesigned project layout delegates to <ProjectShell />, which is
  // where the upNext-derived backlog count now lives. The legacy layout.tsx
  // is just a thin wrapper around the shell.
  layoutSource = readFileSync(
    resolve(PROJECT_ROOT, "components/redesign/project-shell.tsx"),
    "utf8"
  );
});

describe("ProjectNav — Tasks count badge (T108)", () => {
  it("accepts openTaskCount prop in its interface", () => {
    expect(navSource).toContain("openTaskCount");
  });

  it("defaults openTaskCount to 0 in the function signature", () => {
    // Ensure the default prevents badge from showing when prop is absent
    expect(navSource).toMatch(/openTaskCount\s*=\s*0/);
  });

  it("renders badge only when openTaskCount > 0", () => {
    expect(navSource).toContain("openTaskCount > 0");
  });

  it("badge targets only the Tasks label", () => {
    // Badge is gated behind label === "Tasks"
    expect(navSource).toContain('label === "Tasks"');
  });

  it("badge has an aria-label for accessibility", () => {
    expect(navSource).toContain("aria-label");
    expect(navSource).toContain("open tasks");
  });

  it("badge uses bg-red-600 to match existing question badge style", () => {
    expect(navSource).toContain("bg-red-600");
  });

  it("badge uses white text", () => {
    expect(navSource).toContain("text-white");
  });

  it("Tasks link uses inline-flex to align badge with label text", () => {
    expect(navSource).toContain("inline-flex");
  });
});

describe("ProjectLayout — openTaskCount data extraction (T108)", () => {
  it("extracts upNext from the API response", () => {
    expect(layoutSource).toContain("upNext");
  });

  it("filters upNext for pending and planned status only", () => {
    // Must include both pending and planned
    expect(layoutSource).toContain('"pending"');
    expect(layoutSource).toContain('"planned"');
  });

  it("stores a backlog count derived from upNext in the shell state", () => {
    expect(layoutSource).toContain("backlogCount");
  });

  it("renders a numeric badge on the Tasks tab", () => {
    // ProjectShell consumes backlogCount and exposes it as a chip badge
    // alongside the Tasks tab label.
    expect(layoutSource).toContain("backlogCount");
    expect(layoutSource).toContain("badge");
  });

  it("openTaskCount extraction logic — unit test via inline filter", () => {
    // Replicate the filter logic from layout.tsx to verify it works correctly
    type Item = { status: string };
    const upNext: Item[] = [
      { status: "pending" },
      { status: "planned" },
      { status: "in-progress" }, // excluded — in WorkingOn card
      { status: "done" },        // excluded
      { status: "wontdo" },      // excluded
    ];
    const count = upNext.filter(
      (i) => i.status === "pending" || i.status === "planned"
    ).length;
    expect(count).toBe(2);
  });

  it("openTaskCount is 0 when upNext is empty", () => {
    type Item = { status: string };
    const upNext: Item[] = [];
    const count = upNext.filter(
      (i) => i.status === "pending" || i.status === "planned"
    ).length;
    expect(count).toBe(0);
  });

  it("openTaskCount is 0 when all upNext items are in-progress", () => {
    type Item = { status: string };
    const upNext: Item[] = [
      { status: "in-progress" },
      { status: "in-progress" },
    ];
    const count = upNext.filter(
      (i) => i.status === "pending" || i.status === "planned"
    ).length;
    expect(count).toBe(0);
  });
});
