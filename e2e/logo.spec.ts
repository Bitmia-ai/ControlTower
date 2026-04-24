/**
 * E2E tests for the Control Tower split-weight logo mark (BL-047)
 *
 * Verifies the logo appears in the root layout header on every page,
 * is a link pointing to '/', and clicking it from a sub-page navigates home.
 * App must be running at http://localhost:3200.
 */

import { test, expect } from "@playwright/test";

test.describe("Control Tower logo mark", () => {
  test("renders on the home page with both Control and Tower spans", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const logoLink = page.getByRole("link", { name: /control tower/i });
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute("href", "/");
    await expect(logoLink.getByText(/^control$/i)).toBeVisible();
    await expect(logoLink.getByText(/^tower$/i)).toBeVisible();
  });

  test("renders on a project sub-page", async ({ page }) => {
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    const logoLink = page.getByRole("link", { name: /control tower/i });
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toHaveAttribute("href", "/");
  });

  test("clicking the logo from a sub-page navigates back to /", async ({ page }) => {
    await page.goto("/project/0/backlog", { waitUntil: "domcontentloaded" });
    const logoLink = page.getByRole("link", { name: /control tower/i });
    await logoLink.click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
