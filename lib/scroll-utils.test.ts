import { describe, it, expect } from "vitest";
import { isNearBottom } from "./scroll-utils";

describe("isNearBottom", () => {
  // viewport = innerHeight, scrollY = distance scrolled from top,
  // scrollHeight = total document height. Bottom reached when
  // scrollY + innerHeight >= scrollHeight - threshold.

  it("returns true when exactly at the bottom", () => {
    // scrollY=800, innerHeight=600 => bottom edge at 1400; scrollHeight=1400
    expect(isNearBottom(800, 600, 1400, 80)).toBe(true);
  });

  it("returns true when within the threshold of the bottom", () => {
    // bottom edge at 1370, doc 1400, gap=30 <= 80
    expect(isNearBottom(770, 600, 1400, 80)).toBe(true);
  });

  it("returns false when far above the bottom", () => {
    // bottom edge at 600, doc 2000, gap=1400 > 80
    expect(isNearBottom(0, 600, 2000, 80)).toBe(false);
  });

  it("returns false when just beyond the threshold", () => {
    // bottom edge at 1319, doc 1400, gap=81 > 80
    expect(isNearBottom(719, 600, 1400, 80)).toBe(false);
  });

  it("returns true for tiny documents where viewport exceeds content", () => {
    // innerHeight > scrollHeight: always considered at bottom
    expect(isNearBottom(0, 1000, 400, 80)).toBe(true);
  });
});
