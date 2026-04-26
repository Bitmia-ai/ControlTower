import { test, expect } from "@playwright/test";

/**
 * T026 — Collapsible LLM summary on completed backlog items.
 *
 * Verifies:
 *   - On a done backlog item with a Summary field, the green-accented
 *     "Summary" section is visible and expanded by default.
 *   - The chevron toggle collapses the section (aria-expanded flips).
 *   - The Recently Shipped card on mission control shows an inline summary
 *     snippet for done items.
 *
 * Tests run against the ControlTower dashboard on localhost:3200, project 0
 * (ControlTower itself, since T040/T044/T048 etc. carry summaries).
 */

test.describe("Tasks Summary section (T026)", () => {
  test("done item detail page shows expanded Summary section", async ({ page }) => {
    // T048 is known to have a Summary line in backlog.md
    await page.goto("http://localhost:3200/project/0/tasks/T048");
    await page.waitForLoadState("networkidle");

    const summary = page.getByTestId("summary-section");
    await expect(summary).toBeVisible();

    // Heading
    await expect(summary.getByText("Summary", { exact: true })).toBeVisible();

    // Expanded by default for done items — full text node present
    await expect(page.getByTestId("summary-full")).toBeVisible();

    // Toggle button reports aria-expanded=true
    const collapseBtn = summary.getByRole("button", { name: /collapse summary/i });
    await expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
  });

  test("chevron toggle collapses the Summary section", async ({ page }) => {
    await page.goto("http://localhost:3200/project/0/tasks/T048");
    await page.waitForLoadState("networkidle");

    const summary = page.getByTestId("summary-section");
    await expect(summary).toBeVisible();

    const collapseBtn = summary.getByRole("button", { name: /collapse summary/i });
    await collapseBtn.click();

    // After click, the toggle becomes "Expand summary" with aria-expanded=false
    const expandBtn = summary.getByRole("button", { name: /expand summary/i });
    await expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("summary-full")).not.toBeVisible();
  });

  test("Recently Shipped card on mission control shows summary snippet", async ({
    page,
  }) => {
    await page.goto("http://localhost:3200/project/0");
    await page.waitForLoadState("networkidle");

    // The card lists recently shipped backlog items; at least one of the
    // recent ones (T040/041/043/044/048) carries a Summary line.
    const card = page.locator("text=Recently Shipped").locator("..");
    await expect(card).toBeVisible();

    // At least one shipped-summary-* testid should be visible in the card
    const snippets = page.locator('[data-testid^="shipped-summary-"]');
    expect(await snippets.count()).toBeGreaterThan(0);
  });
});
