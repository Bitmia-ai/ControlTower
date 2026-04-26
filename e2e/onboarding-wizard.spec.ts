/**
 * E2E tests for onboarding wizard (T005)
 *
 * Uses Playwright route interception to mock API calls,
 * testing the Add Project → Onboarding Wizard flow.
 */

import { test, expect } from "@playwright/test";

test.describe("Onboarding wizard", () => {
  test("Add Project dialog opens, submits, and redirects to project page", async ({ page }) => {
    // Mock projects list API
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              { name: "haze", path: "/Users/casa/haze", initialized: true, running: false },
              { name: "test-project", path: "/tmp/test-project", initialized: false, running: false },
            ],
          }),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { name: "test-project", path: "/tmp/test-project" } }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock project detail for the new project (index 1)
    await page.route("**/api/projects/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            project: {
              name: "test-project",
              path: "/tmp/test-project",
              initialized: false,
              running: false,
            },
            state: null,
            tasks: [],
            questions: [],
          },
        }),
      });
    });

    // Mock cost and stream for project 1
    await page.route("**/api/projects/1/cost", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { session: 0, total: 0 } }) });
    });
    await page.route("**/api/projects/1/stream", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "data: {}\n\n" });
    });

    // 1. Navigate to home page
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // 2. Click Add Project button
    const addBtn = page.getByRole("button", { name: /add project/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 3. Verify dialog opens
    await expect(page.getByText("Register a local project directory")).toBeVisible();

    // 4. Fill in form fields
    const nameInput = page.locator('input[placeholder="my-app"]');
    const pathInput = page.locator('input[placeholder="/Users/you/my-app"]');
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill("test-project");
    await pathInput.fill("/tmp/test-project");

    // 5. Submit
    await page.getByRole("button", { name: /add project/i }).last().click();
    await page.waitForTimeout(1000);

    // 6. Verify redirect to project page
    await expect(page).toHaveURL(/\/project\/1/);
  });

  test("Add Project dialog shows validation error on empty fields", async ({ page }) => {
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [{ name: "haze", path: "/Users/casa/haze", initialized: true, running: false }] }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /add project/i }).click();
    await expect(page.getByText("Register a local project directory")).toBeVisible();

    // Try to submit with empty fields — HTML5 validation should prevent submission
    const submitBtn = page.getByRole("button", { name: /add project/i }).last();
    await submitBtn.click();

    // Dialog should still be open (form didn't submit)
    await expect(page.getByText("Register a local project directory")).toBeVisible();
  });
});
