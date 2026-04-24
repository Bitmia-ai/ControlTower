/**
 * E2E tests for BL-024 — aria-labels on interactive UI controls.
 *
 * Asserts that the dashboard's icon-only buttons and form fields are
 * reachable by their accessible names (the ones added by BL-024). These
 * use Playwright's getByRole/getByLabel which only resolves when the
 * accessible-name lookup succeeds — i.e. the aria-label / htmlFor /
 * <label> wiring is correct.
 */

import { test, expect } from "@playwright/test";

test.describe("BL-024 aria-labels", () => {
  test("Add Project dialog: Name and Path inputs are reachable via getByLabel", async ({
    page,
  }) => {
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                name: "haze",
                path: "/Users/casa/haze",
                initialized: true,
                running: false,
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    // Open Add Project dialog
    await page.getByRole("button", { name: /add project/i }).click();
    await expect(page.getByText("Register a local project directory")).toBeVisible();

    // Both inputs are reachable purely via their visible labels — this
    // only resolves when label htmlFor matches input id.
    const nameInput = page.getByLabel("Name", { exact: true });
    const pathInput = page.getByLabel("Path", { exact: true });
    await expect(nameInput).toBeVisible();
    await expect(pathInput).toBeVisible();
    expect(await nameInput.evaluate((el) => (el as HTMLInputElement).id)).toBe(
      "project-name"
    );
    expect(await pathInput.evaluate((el) => (el as HTMLInputElement).id)).toBe(
      "project-path"
    );
  });

  test("Project card: Trash2 delete button has accessible name including project name", async ({
    page,
  }) => {
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                name: "haze",
                path: "/Users/casa/haze",
                initialized: true,
                running: false,
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });
    // Stub status so PhaseBadge / cards render
    await page.route("**/api/projects/0", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            project: {
              name: "haze",
              path: "/Users/casa/haze",
              initialized: true,
              running: false,
              phase: "BUILD",
              questionCount: 0,
            },
          },
        }),
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    // The icon-only Trash2 button is reachable by accessible name
    // "Remove haze" — not by visible text, since it has none.
    const removeBtn = page.getByRole("button", { name: "Remove haze" });
    await expect(removeBtn).toBeVisible();
  });
});
