/**
 * E2E tests for the Steer tab (T063)
 *
 * Verifies the Steer tab appears in the project nav, the form is interactive,
 * submitting a directive POSTs to the API, and the directive list refreshes.
 *
 * Uses Playwright route interception to mock all API calls — no real
 * filesystem writes or server required.
 */

import { test, expect } from "@playwright/test";

const MINIMAL_PROJECT_DETAIL = {
  data: {
    project: {
      name: "haze",
      path: "/tmp/haze",
      initialized: true,
      running: false,
      hasTranscript: false,
      sessionStatus: { cto: { status: "stopped", pid: null, lastActivity: null } },
    },
    state: {
      iteration: 10,
      phase: "TRIAGE",
      phase_status: "complete",
      task_id: null,
      task_title: null,
      health: {
        confidence: "HIGH",
        env_status: "healthy",
        iterations_since_last_deploy: 0,
        questions_awaiting_ceo: 0,
        blocked_items_count: 0,
      },
    },
    currentTask: null,
    activeItem: null,
    pendingQuestions: [],
    upNext: [],
    recentlyShipped: [],
    recentChangelog: [],
    steeringDirectives: [],
  },
};

test.describe("Steer tab (T063)", () => {
  test("renders Steer tab, submits a directive, refreshes the list", async ({
    page,
  }) => {
    let directiveSubmitted = false;

    // Mock project detail
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MINIMAL_PROJECT_DETAIL),
        });
      } else {
        await route.continue();
      }
    });

    // Mock cost API
    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
      });
    });

    // Mock SSE stream
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // Mock GET steer — returns empty list initially, then 1 directive after POST
    await page.route("**/api/projects/0/steer", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        const directives = directiveSubmitted
          ? [{ text: "stay focused on UX (2026-04-25)" }]
          : [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { directives } }),
        });
      } else if (method === "POST") {
        directiveSubmitted = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true } }),
        });
      } else {
        await route.continue();
      }
    });

    // 1. Navigate to project root and verify Steer tab is visible
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Steer" })).toBeVisible();

    // 2. Click the Steer tab
    await page.getByRole("link", { name: "Steer" }).click();
    await page.waitForURL(/\/project\/0\/steer/, { timeout: 5000 });

    // 3. Verify the heading
    await expect(page.getByRole("heading", { name: "Steer", level: 1 })).toBeVisible();

    // 4. Empty state shown initially
    await expect(page.getByText("No directives yet.")).toBeVisible({
      timeout: 5000,
    });

    // 5. Submit button should be disabled when textarea is empty
    const submitBtn = page.getByRole("button", { name: /Send Directive/i });
    await expect(submitBtn).toBeDisabled();

    // 6. Type a directive
    const textarea = page.getByLabel("New directive");
    await textarea.fill("stay focused on UX");

    // 7. Submit button enabled, click it
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 8. Success message appears
    await expect(page.getByText("Directive added.")).toBeVisible({
      timeout: 5000,
    });

    // 9. Textarea cleared
    await expect(textarea).toHaveValue("");

    // 10. Directive appears in list (refetch)
    await expect(page.getByText("stay focused on UX")).toBeVisible({
      timeout: 5000,
    });
    // Date badge from parsed text
    await expect(page.getByText("2026-04-25")).toBeVisible();
  });
});
