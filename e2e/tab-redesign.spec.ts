/**
 * E2E smoke tests for T056 tab redesign.
 * Verifies that the backlog, history, and live tabs render with the
 * expected new structural elements (section headers, section dividers, toolbar).
 *
 * App must be running at http://localhost:3200.
 */

import { test, expect } from "@playwright/test";

test.describe("T056: Tab redesign smoke tests", () => {
  test("Tasks tab renders without errors and shows main page structure", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("http://localhost:3200/project/0/tasks", {
      waitUntil: "networkidle",
    });

    // Page title / heading area
    await expect(page.locator("main")).toBeVisible();

    // Add Item button present
    await expect(page.getByRole("button", { name: /add item/i })).toBeVisible();

    // No JS errors
    expect(errors).toHaveLength(0);
  });

  test("History tab renders Sessions and Iteration Log sections", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("http://localhost:3200/project/0/history", {
      waitUntil: "networkidle",
    });

    // Both sections visible
    const sessionsSection = page.getByRole("region", { name: "Sessions" });
    await expect(sessionsSection).toBeVisible();

    const iterationSection = page.getByRole("region", { name: "Iteration Log" });
    await expect(iterationSection).toBeVisible();

    // Section separator (horizontal rule between sections)
    const divider = page.locator(".border-t").first();
    await expect(divider).toBeAttached();

    // No JS errors
    expect(errors).toHaveLength(0);
  });

  test("Live tab renders toolbar and appropriate state", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("http://localhost:3200/project/0/live", {
      waitUntil: "networkidle",
    });

    await expect(page.locator("main")).toBeVisible();

    // Sticky toolbar is present and contains connection status
    const toolbar = page.locator(".sticky.top-0").first();
    await expect(toolbar).toBeVisible();

    // No JS errors
    expect(errors).toHaveLength(0);
  });
});
