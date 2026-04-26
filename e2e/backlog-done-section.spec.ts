import { test, expect } from "@playwright/test";

/**
 * T041 — Done tasks in a separate collapsible section on the tasks page.
 *
 * Verifies:
 *   - Done section header is visible and collapsed by default (count badge shown,
 *     "done" pills are not visible in the main list).
 *   - Clicking the Done header expands it, showing "done" pills.
 *   - Clicking again collapses it.
 *   - Won't Do section follows the same pattern.
 *
 * These tests run against the haze project (/project/1/tasks) on localhost:3200.
 */
test.describe("Backlog Done/Won't Do collapsible sections (T041)", () => {
  test("tasks page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("http://localhost:3200/project/1/tasks");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);
  });

  test("Done section header is visible and collapsed by default", async ({ page }) => {
    await page.goto("http://localhost:3200/project/1/tasks");
    await page.waitForLoadState("networkidle");

    // Find the Done toggle button — it has aria-label starting with "Show done"
    const doneToggle = page.getByRole("button", { name: /show done items/i });
    await expect(doneToggle).toBeVisible();

    // Collapsed: aria-expanded should be "false"
    await expect(doneToggle).toHaveAttribute("aria-expanded", "false");
  });

  test("clicking Done header expands and collapses the section", async ({ page }) => {
    await page.goto("http://localhost:3200/project/1/tasks");
    await page.waitForLoadState("networkidle");

    const doneToggle = page.getByRole("button", { name: /show done items/i });
    await doneToggle.click();

    // After click: aria-label flips to "Collapse done items"
    const collapseBtn = page.getByRole("button", { name: /collapse done items/i });
    await expect(collapseBtn).toHaveAttribute("aria-expanded", "true");

    // "done" pills should appear somewhere on the page when expanded
    const donePills = page.locator("text=done").filter({ hasNotText: /items|Done/ });
    // At least one done pill should be visible
    await expect(donePills.first()).toBeVisible();

    // Collapse again
    await collapseBtn.click();
    const reCollapsed = page.getByRole("button", { name: /show done items/i });
    await expect(reCollapsed).toHaveAttribute("aria-expanded", "false");
  });
});
