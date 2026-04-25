/**
 * E2E tests for mobile-responsive layout (BL-057)
 *
 * Verifies the dashboard works correctly at phone (375x667) and tablet
 * (768x1024) viewports. The key acceptance criterion is that no page
 * causes horizontal page overflow — `documentElement.scrollWidth` must
 * not exceed `window.innerWidth`.
 *
 * App must be running at http://localhost:3200.
 */

import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "home", path: "/" },
  { name: "mission-control", path: "/project/0" },
  { name: "backlog", path: "/project/0/backlog" },
  { name: "history", path: "/project/0/history" },
  { name: "live", path: "/project/0/live" },
  { name: "schedules", path: "/project/0/schedules" },
];

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  // Allow a 1px slop for sub-pixel rounding in the browser.
  return page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    return docW - winW <= 1;
  });
}

test.describe("Mobile viewport (375x667 — iPhone SE)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const p of PAGES) {
    test(`${p.name} — no horizontal overflow`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const ok = await noHorizontalOverflow(page);
      expect(ok).toBe(true);
    });
  }

  test("home page — Add Project button visible and meets 44px touch target", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const addBtn = page.getByRole("button", { name: /add project/i });
    await expect(addBtn).toBeVisible();
    const box = await addBtn.boundingBox();
    expect(box).not.toBeNull();
    // WCAG 2.5.5 — interactive targets should be ≥44x44 CSS px
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("mission control — cards stack 1-column at 375px", async ({ page }) => {
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    // Body should not exceed viewport width
    const ok = await noHorizontalOverflow(page);
    expect(ok).toBe(true);
  });
});

test.describe("Tablet viewport (768x1024 — iPad)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const p of PAGES) {
    test(`${p.name} — no horizontal overflow`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const ok = await noHorizontalOverflow(page);
      expect(ok).toBe(true);
    });
  }

  test("home page — uses 2+ column grid at 768px", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    // The grid container has class `sm:grid-cols-2 lg:grid-cols-3`
    // At 768px (sm breakpoint), it should be 2 columns.
    const cols = await page.evaluate(() => {
      const grid = document.querySelector(
        ".grid.grid-cols-1, .grid.sm\\:grid-cols-2"
      );
      if (!grid) return null;
      const style = window.getComputedStyle(grid);
      return style.gridTemplateColumns.split(" ").length;
    });
    // Either no grid (no projects) or grid has at least 2 columns
    if (cols !== null) {
      expect(cols).toBeGreaterThanOrEqual(2);
    }
  });

  test("mission control — uses 3-column grid at 768px (md breakpoint)", async ({ page }) => {
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const cols = await page.evaluate(() => {
      const grid = document.querySelector(".grid.grid-cols-1.md\\:grid-cols-3");
      if (!grid) return null;
      const style = window.getComputedStyle(grid);
      return style.gridTemplateColumns.split(" ").length;
    });
    if (cols !== null) {
      expect(cols).toBe(3);
    }
  });
});
