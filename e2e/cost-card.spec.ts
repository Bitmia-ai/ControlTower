/**
 * E2E tests for the Cost card (BL-049)
 *
 * Verifies the cost card renders on the mission control page, displays
 * non-negative values, and upholds the sessionCost <= totalCost invariant.
 *
 * Uses Playwright route interception to mock all API calls.
 */

import { test, expect } from "@playwright/test";

const MINIMAL_PROJECT_DETAIL = {
  data: {
    project: {
      name: "haze",
      path: "/Users/casa/haze",
      initialized: true,
      running: false,
      hasTranscript: false,
      sessionStatus: { cto: { status: "stopped", pid: null, lastActivity: null } },
    },
    state: {
      iteration: 10,
      phase: "TRIAGE",
      phase_status: "complete",
      backlog_item: null,
      backlog_title: null,
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

test.describe("Cost card (BL-049)", () => {
  test("renders cost card with non-negative values and upholds session <= total invariant", async ({
    page,
  }) => {
    // Mock project detail API
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

    // Mock cost API — session: $1.25, total: $42.50
    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 1.25, total: 42.5 } }),
      });
    });

    // Mock stream SSE to prevent hanging connections
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // 1. Navigate to mission control
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // 2. Wait for cost card heading to appear (loading skeleton replaced)
    const costHeading = page.getByText("Cost", { exact: true });
    await expect(costHeading).toBeVisible({ timeout: 5000 });

    // 3. Wait for the loading state to resolve — skeleton is replaced when
    //    cost values render. The session cost text contains "$" and "this session".
    const sessionLabel = page.getByText(/this session \(est\.\)/i);
    await expect(sessionLabel).toBeVisible({ timeout: 5000 });

    // 4. Extract session cost value — rendered as "$X.XX" in font-semibold span
    //    adjacent to "this session (est.)" label
    const sessionCostLocator = page
      .locator("text=this session (est.)")
      .locator("..")
      .locator("span.font-semibold");
    const sessionCostText = await sessionCostLocator.textContent();
    expect(sessionCostText).not.toBeNull();
    const sessionCost = parseFloat((sessionCostText ?? "").replace("$", ""));
    expect(sessionCost).toBeGreaterThanOrEqual(0);

    // 5. Extract total cost value — rendered as "$X.XX" in font-medium span
    //    adjacent to "total (est.)" label
    const totalLabel = page.getByText(/total \(est\.\)/i);
    await expect(totalLabel).toBeVisible();
    const totalCostLocator = page
      .locator("text=total (est.)")
      .locator("..")
      .locator("span.font-medium");
    const totalCostText = await totalCostLocator.textContent();
    expect(totalCostText).not.toBeNull();
    const totalCost = parseFloat((totalCostText ?? "").replace("$", ""));
    expect(totalCost).toBeGreaterThanOrEqual(0);

    // 6. Assert invariant: session cost <= total cost
    expect(sessionCost).toBeLessThanOrEqual(totalCost);
  });

  test("cost card shows correct formatted values", async ({ page }) => {
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

    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 1.25, total: 42.5 } }),
      });
    });

    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Verify exact formatted values appear in the DOM
    await expect(page.getByText("$1.25")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("$42.50")).toBeVisible({ timeout: 5000 });
  });
});
