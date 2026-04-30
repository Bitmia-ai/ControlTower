/**
 * E2E test for Force Stop two-click confirmation flow.
 *
 * The Stop button on Mission Control has a chevron that opens a dropdown
 * with "Force Stop". Clicking once arms the kill — the menu item rewrites
 * itself to "Confirm hard kill — click again". Clicking the same item again
 * fires POST /api/projects/[id]/force-stop. This spec covers that path
 * end-to-end with mocked APIs (no real Claude session spawned).
 *
 * Convention: route-mock everything; assert with auto-retrying matchers
 * (`toBeVisible`, `toHaveText`); never `waitForTimeout`.
 */

import { test, expect } from "@playwright/test";

const PROJECT_DETAIL_RUNNING = {
  data: {
    project: {
      name: "haze",
      path: "/tmp/haze",
      initialized: true,
      running: true,
      sessionStatus: { cto: { status: "running", pid: 12345, lastActivity: Date.now() } },
    },
    state: {
      iteration: 10,
      phase: "BUILD",
      phase_status: "pending",
      task_id: "T007",
      task_title: "Add widget support",
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
    allDoneItems: [],
    recentChangelog: [],
    steeringDirectives: [],
  },
};

test.describe("Force Stop flow", () => {
  test("two-click confirmation fires POST /force-stop", async ({ page }) => {
    let forceStopCalled = false;

    // Mock project detail — always running so the Stop button + chevron render
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PROJECT_DETAIL_RUNNING),
        });
      } else {
        await route.continue();
      }
    });

    // Mock cost API (mission-control polls it on render)
    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0.1, total: 1.0 } }),
      });
    });

    // Mock force-stop endpoint and record that it was hit
    await page.route("**/api/projects/0/force-stop", async (route) => {
      forceStopCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { success: true } }),
      });
    });

    // Mock SSE stream so the live tab doesn't dangle a real connection
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // 1. Visit project mission control
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // 2. Stop button (running state) should be present
    const stopBtn = page.getByRole("button", { name: "Stop", exact: true });
    await expect(stopBtn).toBeVisible();

    // 3. Open the Stop dropdown chevron
    const chevron = page.getByRole("button", { name: "More stop options" });
    await expect(chevron).toBeVisible();
    await chevron.click();

    // 4. Click "Force Stop" — first click only arms the confirmation
    const forceStop = page.getByRole("menuitem", { name: "Force Stop" });
    await expect(forceStop).toBeVisible();
    await forceStop.click();

    // 5. Verify the inline confirmation prompt appears
    const confirm = page.getByRole("menuitem", {
      name: /Confirm hard kill — click again/i,
    });
    await expect(confirm).toBeVisible();

    // The first click must NOT have fired the request
    expect(forceStopCalled).toBe(false);

    // 6. Click again — this is the actual kill
    await confirm.click();

    // 7. Verify the request fired. The mocked handler flips the flag
    //    synchronously inside its route fulfillment; pollUntil bridges
    //    any in-flight serialization without a hardcoded sleep.
    await expect.poll(() => forceStopCalled, { timeout: 5_000 }).toBe(true);
  });
});
