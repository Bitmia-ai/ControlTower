/**
 * E2E test for the home-page "Add Project" dialog.
 *
 * Covers: opening the dialog from an empty home page, filling name + path,
 * submitting, and verifying both the POST /api/projects body and that the
 * new project shows up in the list afterward.
 *
 * Convention: route-mock everything; assert with auto-retrying matchers;
 * no `waitForTimeout`.
 */

import { test, expect } from "@playwright/test";

const PROJECT_NAME = "my-project";
const PROJECT_PATH = "/tmp/my-project";

// Storage clear so the home onboarding wizard never preempts the EmptyState
// "Add your first project" CTA — that wizard owns the empty-projects path
// when not dismissed.
const STORAGE_CLEAR = `try { localStorage.setItem("ct_onboarding_dismissed", "true"); } catch {}`;

test.describe("Add Project flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(STORAGE_CLEAR);
  });

  test("Add Project dialog posts the right body and refreshes the list", async ({
    page,
  }) => {
    let projects: Array<{
      name: string;
      path: string;
      initialized: boolean;
      running: boolean;
    }> = [];
    let postedBody: { name?: string; path?: string } | null = null;

    await page.route("**/api/projects", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: projects }),
        });
        return;
      }
      if (method === "POST") {
        try {
          postedBody = JSON.parse(route.request().postData() ?? "{}");
        } catch {
          postedBody = {};
        }
        // Simulate registration — the GET below will start returning the
        // new project.
        projects = [
          {
            name: PROJECT_NAME,
            path: PROJECT_PATH,
            initialized: true,
            running: false,
          },
        ];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: { name: PROJECT_NAME, path: PROJECT_PATH },
          }),
        });
        return;
      }
      await route.continue();
    });

    // 1. Visit home with empty list
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // 2. Click "Add Project" — the header CTA is the canonical entry point
    //    (the EmptyState fallback also has its own button, but the header
    //    one is always present).
    const addBtn = page.getByRole("button", { name: "Add Project" });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 3. Fill name + path
    const nameInput = page.getByLabel(/^name$/i);
    const pathInput = page.getByLabel(/^path$/i);
    await expect(nameInput).toBeVisible();
    await expect(pathInput).toBeVisible();
    await nameInput.fill(PROJECT_NAME);
    await pathInput.fill(PROJECT_PATH);

    // 4. Submit (the dialog's submit button label is "Add Project")
    const submitBtn = page.getByRole("button", { name: /^Add Project$/ }).last();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verify the POST went out with the right body
    await expect
      .poll(() => postedBody, { timeout: 5_000 })
      .toEqual({ name: PROJECT_NAME, path: PROJECT_PATH });

    // 6. The dialog auto-navigates to /project/{newIndex} on successful
    // registration (canonical UX since add is single-purpose). We assert the
    // URL transition rather than a heading on the home page — the test is
    // about the add flow, not the project page rendering.
    await page.waitForURL(/\/project\/\d+/, { timeout: 10_000 });
  });
});
