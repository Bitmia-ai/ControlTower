/**
 * E2E tests for the home-page onboarding wizard (T111).
 *
 * Uses Playwright route interception to mock the projects API,
 * exercising the wizard from the empty-projects state without touching
 * real RedEye data.
 */

import { test, expect } from "@playwright/test";

const STORAGE_CLEAR = `try { localStorage.removeItem("ct_onboarding_dismissed"); } catch {}`;

async function mockEmptyProjects(page: import("@playwright/test").Page) {
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe("HomeOnboardingWizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(STORAGE_CLEAR);
  });

  test("wizard renders when no projects are registered", async ({ page }) => {
    await mockEmptyProjects(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /welcome to control tower/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /skip/i })).toBeVisible();
  });

  test("Get Started and Next buttons advance through steps", async ({ page }) => {
    await mockEmptyProjects(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page.getByRole("heading", { name: /prerequisites/i })).toBeVisible();

    await page.getByRole("button", { name: /^next/i }).click();
    await expect(
      page.getByRole("heading", { name: /register your first project/i })
    ).toBeVisible();

    await expect(page.getByLabel(/^name$/i)).toBeVisible();
    await expect(page.getByLabel(/^path$/i)).toBeVisible();
  });

  test("Skip dismisses wizard and shows EmptyState fallback", async ({ page }) => {
    await mockEmptyProjects(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /skip/i }).click();

    // Wizard's "Get Started" CTA should be gone
    await expect(page.getByRole("button", { name: /get started/i })).toHaveCount(0);
    // EmptyState's "Add your first project" CTA should be present
    await expect(
      page.getByRole("button", { name: /add your first project/i })
    ).toBeVisible();
  });

  test("dismiss state persists across reload", async ({ page }) => {
    await mockEmptyProjects(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /skip/i }).click();

    // Verify localStorage is set
    const flag = await page.evaluate(() =>
      localStorage.getItem("ct_onboarding_dismissed")
    );
    expect(flag).toBe("true");

    // The beforeEach addInitScript clears the dismissed flag on every
    // navigation, including reloads. To verify dismissal *actually*
    // persists, re-set the flag via an additional init script that runs
    // after the clearing one.
    await page.addInitScript(
      `try { localStorage.setItem("ct_onboarding_dismissed", "true"); } catch {}`
    );

    // Reload — wizard should stay hidden, EmptyState should appear
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /get started/i })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /add your first project/i })
    ).toBeVisible();
  });

  test("wizard disappears after a project is registered", async ({ page }) => {
    let projectsList: Array<{ name: string; path: string; initialized: boolean; running: boolean }> = [];

    await page.route("**/api/projects", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: projectsList }),
        });
      } else if (method === "POST") {
        // Simulate registration
        projectsList = [
          { name: "demo", path: "/tmp/demo", initialized: false, running: false },
        ];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: { name: "demo", path: "/tmp/demo" },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /get started/i }).click();
    await page.getByRole("button", { name: /^next/i }).click();

    await page.getByLabel(/^name$/i).fill("demo");
    await page.getByLabel(/^path$/i).fill("/tmp/demo");
    await page.getByRole("button", { name: /register project/i }).click();

    // Step 4 ("Start the Loop") may be skipped quickly when fetchProjects
    // resolves immediately after the POST — in that case the wizard
    // unmounts and the project grid takes over. Either outcome is valid;
    // the contract is that the wizard yields to the project grid.
    // After the polling fetch resolves, the project grid should appear
    // (project card text contains the registered name).
    await expect(
      page.getByRole("heading", { name: /^demo$/, level: 2 })
    ).toBeVisible({ timeout: 15_000 });
  });
});
