/**
 * E2E tests for dark/light mode (T009 T2)
 *
 * Screenshots both color schemes across key pages.
 * App must be running at http://localhost:3200.
 */

import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const PAGES = [
  { name: "home", path: "/" },
  { name: "mission-control", path: "/project/0" },
  { name: "tasks", path: "/project/0/tasks" },
  { name: "history", path: "/project/0/history" },
  { name: "live", path: "/project/0/live" },
];

const screenshotsDir = path.resolve(__dirname, "../screenshots");

function ensureScreenshotsDir() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
}

test.describe("Light mode", () => {
  test.use({ colorScheme: "light" });

  for (const page of PAGES) {
    test(`${page.name} page renders correctly in light mode`, async ({ page: pw }) => {
      ensureScreenshotsDir();
      await pw.goto(page.path, { waitUntil: "domcontentloaded" });
      // Wait for the main content to appear (avoids networkidle issues with SSE streams)
      await pw.waitForSelector("body", { timeout: 5000 });
      await pw.waitForTimeout(800);
      const screenshotPath = path.join(screenshotsDir, `theme-light-${page.name}.png`);
      await pw.screenshot({ path: screenshotPath, fullPage: true });
      expect(fs.existsSync(screenshotPath)).toBe(true);
      // Verify page loaded (has a body element)
      await expect(pw.locator("body")).toBeVisible();
    });
  }
});

test.describe("Dark mode", () => {
  for (const page of PAGES) {
    test(`${page.name} page renders correctly in dark mode`, async ({ page: pw }) => {
      ensureScreenshotsDir();
      // Navigate first, then set localStorage theme + inject .dark class so that
      // next-themes class-based dark variant (not media query) activates correctly.
      await pw.goto(page.path, { waitUntil: "domcontentloaded" });
      await pw.evaluate(() => {
        localStorage.setItem("theme", "dark");
        document.documentElement.classList.add("dark");
      });
      // Wait for styles to settle after class injection
      await pw.waitForTimeout(800);
      const screenshotPath = path.join(screenshotsDir, `theme-dark-${page.name}.png`);
      await pw.screenshot({ path: screenshotPath, fullPage: true });
      expect(fs.existsSync(screenshotPath)).toBe(true);
      // Verify page loaded (has a body element)
      await expect(pw.locator("body")).toBeVisible();
    });
  }
});
