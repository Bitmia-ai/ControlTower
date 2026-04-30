/**
 * Tests for taskAuthor() and AUTHOR_BADGE_STYLES.
 *
 * The author of a task is derived at render time from the `section` field on
 * TaskItem. Only `"ceo"` items are user-submitted; everything else (including
 * `"wontdo"` and unknown values) is RedEye-generated.
 */

import { describe, expect, it } from "vitest";
import {
  AUTHOR_BADGE_STYLES,
  taskAuthor,
  type TaskAuthor,
} from "./task-badge-styles";

describe("taskAuthor", () => {
  it("classifies ceo section as user", () => {
    expect(taskAuthor("ceo")).toBe<TaskAuthor>("user");
  });

  it("classifies discovered section as redeye", () => {
    expect(taskAuthor("discovered")).toBe<TaskAuthor>("redeye");
  });

  it("classifies triaged section as redeye", () => {
    expect(taskAuthor("triaged")).toBe<TaskAuthor>("redeye");
  });

  it("classifies wontdo section as redeye", () => {
    expect(taskAuthor("wontdo")).toBe<TaskAuthor>("redeye");
  });

  it("falls back to redeye for unknown sections", () => {
    expect(taskAuthor("anything-else")).toBe<TaskAuthor>("redeye");
  });

  it("falls back to redeye for undefined section", () => {
    expect(taskAuthor(undefined)).toBe<TaskAuthor>("redeye");
  });
});

describe("AUTHOR_BADGE_STYLES", () => {
  it("uses 'Created by User' for the user variant", () => {
    expect(AUTHOR_BADGE_STYLES.user.label).toBe("Created by User");
  });

  it("uses 'Created by RedEye' for the redeye variant", () => {
    expect(AUTHOR_BADGE_STYLES.redeye.label).toBe("Created by RedEye");
  });

  it("applies blue palette to user badge in light and dark mode", () => {
    const cls = AUTHOR_BADGE_STYLES.user.className;
    expect(cls).toContain("bg-blue-50");
    expect(cls).toContain("text-blue-700");
    expect(cls).toContain("dark:bg-blue-950/30");
    expect(cls).toContain("dark:text-blue-300");
  });

  it("applies violet palette to redeye badge in light and dark mode", () => {
    const cls = AUTHOR_BADGE_STYLES.redeye.className;
    expect(cls).toContain("bg-violet-50");
    expect(cls).toContain("text-violet-700");
    expect(cls).toContain("dark:bg-violet-950/30");
    expect(cls).toContain("dark:text-violet-300");
  });

  it("has exactly the two known author keys", () => {
    expect(Object.keys(AUTHOR_BADGE_STYLES).sort()).toEqual([
      "redeye",
      "user",
    ]);
  });
});
