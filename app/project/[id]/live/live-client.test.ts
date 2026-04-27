/**
 * @vitest-environment node
 *
 * T080 — Live tab toolbar button improvements.
 *
 * Strategy: read the source of live-client.tsx and assert that the correct
 * icon names and text labels are present. This avoids mounting the client
 * component (which uses browser-only APIs: use(params), EventSource, window.*)
 * and gives us solid regression protection against reverting the UX change.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let liveClientSource = "";

beforeAll(() => {
  liveClientSource = readFileSync(
    resolve(__dirname, "./live-client.tsx"),
    "utf8"
  );
});

describe("Live tab toolbar — icon selection (T080)", () => {
  it("imports UnfoldVertical icon for expand-all button", () => {
    expect(liveClientSource).toContain("UnfoldVertical");
  });

  it("imports FoldVertical icon for collapse-all button", () => {
    expect(liveClientSource).toContain("FoldVertical");
  });

  it("imports ChevronsDown icon for auto-scroll button", () => {
    expect(liveClientSource).toContain("ChevronsDown");
  });

  it("does NOT import ChevronsUpDown (old ambiguous expand/collapse icon)", () => {
    // The old code used ChevronsUpDown for BOTH expand and collapse (just rotated),
    // making the two buttons visually indistinguishable.
    expect(liveClientSource).not.toContain("ChevronsUpDown");
  });

  it("does NOT import ArrowDown (old auto-scroll icon)", () => {
    // ArrowDown was replaced by ChevronsDown to better convey 'keep scrolling down'.
    expect(liveClientSource).not.toContain("ArrowDown");
  });
});

describe("Live tab toolbar — text labels (T080)", () => {
  it("renders 'Expand all' text label on expand button", () => {
    expect(liveClientSource).toContain("Expand all");
  });

  it("renders 'Collapse all' text label on collapse button", () => {
    expect(liveClientSource).toContain("Collapse all");
  });

  it("renders 'Auto-scroll' text label on auto-scroll button", () => {
    expect(liveClientSource).toContain("Auto-scroll");
  });
});

describe("Live tab toolbar — accessibility (T080)", () => {
  it("expand-all button has aria-label=\"Expand all\"", () => {
    expect(liveClientSource).toContain('aria-label="Expand all"');
  });

  it("collapse-all button has aria-label=\"Collapse all\"", () => {
    expect(liveClientSource).toContain('aria-label="Collapse all"');
  });

  it("buttons use inline-flex with icon+text layout", () => {
    // Each button should use inline-flex to lay out icon and text side by side.
    expect(liveClientSource).toContain("inline-flex items-center gap-1.5");
  });
});
