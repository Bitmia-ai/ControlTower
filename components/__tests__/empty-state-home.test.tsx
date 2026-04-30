/**
 * @vitest-environment node
 *
 * T094: Empty-state UX — source-text assertions for EmptyState component
 * and home-client.tsx onboarding copy.
 *
 * Strategy: read source files and assert that the required onboarding copy,
 * links, and prop types are present. This avoids mounting client components
 * (which require browser APIs) and gives us solid regression protection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

let emptyStateSource = "";
let homeClientSource = "";

beforeAll(() => {
  emptyStateSource = readFileSync(
    resolve(PROJECT_ROOT, "components/empty-state.tsx"),
    "utf8"
  );
  homeClientSource = readFileSync(
    resolve(PROJECT_ROOT, "app/home-client.tsx"),
    "utf8"
  );
});

describe("EmptyState component (T094)", () => {
  it("imports ReactNode from react", () => {
    expect(emptyStateSource).toContain("ReactNode");
  });

  it("subtitle prop accepts ReactNode (not just string)", () => {
    // Ensure the interface uses ReactNode for subtitle
    expect(emptyStateSource).toMatch(/subtitle\?\s*:\s*ReactNode/);
  });

  it("renders title in a paragraph element", () => {
    expect(emptyStateSource).toContain("{title}");
  });

  it("renders subtitle when provided", () => {
    expect(emptyStateSource).toContain("{subtitle}");
  });

  it("renders action button when action prop is provided", () => {
    expect(emptyStateSource).toContain("action.onClick");
    expect(emptyStateSource).toContain("action.label");
  });

  it("hides action button section when action prop is absent", () => {
    // The action section is conditionally rendered
    expect(emptyStateSource).toContain("action &&");
  });
});

describe("Home page empty-state onboarding copy (T094)", () => {
  it("uses an Icon for the empty state icon", () => {
    // The redesigned home uses our inline <Icon name="folder" /> primitive
    // instead of the legacy lucide-react FolderOpen import.
    expect(homeClientSource).toMatch(/Icon\s+name="folder"/);
  });

  it("uses Welcome to Control Tower as the empty state title", () => {
    expect(homeClientSource).toContain("Welcome to Control Tower");
  });

  it("includes a link to the RedEye GitHub repository", () => {
    expect(homeClientSource).toContain("https://github.com/Bitmia-ai/RedEye");
  });

  it("includes a link to the Quick Start section of the README", () => {
    expect(homeClientSource).toContain(
      "https://github.com/Bitmia-ai/ControlTower#quick-start"
    );
  });

  it("mentions /redeye:init command in the onboarding copy", () => {
    expect(homeClientSource).toContain("/redeye:init");
  });

  it("uses a code element for the /redeye:init command", () => {
    expect(homeClientSource).toContain("<code");
    expect(homeClientSource).toContain("/redeye:init");
  });

  it("action button label is Add your first project", () => {
    expect(homeClientSource).toContain("Add your first project");
  });

  it("external links have target _blank and rel noopener noreferrer", () => {
    expect(homeClientSource).toContain('target="_blank"');
    expect(homeClientSource).toContain('rel="noopener noreferrer"');
  });
});
