/**
 * E2E tests for T052 — keyboard shortcuts for mission-control actions.
 *
 * Verifies that:
 *   - Pressing 'x' on the project page with a running project triggers POST /stop
 *   - Pressing 's' on an idle project triggers POST /start
 *   - Pressing 'b' opens the Add Task dialog
 *   - 'g' then 'b' chord navigates to the tasks page
 *   - kbd hint badges are rendered in the controls card and nav
 */

import { test, expect } from "@playwright/test";

function detail(running: boolean) {
  return {
    data: {
      project: {
        name: "haze",
        path: "/tmp/haze",
        initialized: true,
        running,
        hasTranscript: false,
        sessionStatus: running
          ? { cto: { status: "running", pid: 1234, lastActivity: Date.now() } }
          : { cto: { status: "stopped", pid: null, lastActivity: null } },
      },
      state: {
        iteration: 1,
        phase: "BUILD",
        phase_status: "in-progress",
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
}

async function stubCommon(page: import("@playwright/test").Page) {
  await page.route("**/api/projects/0/cost", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { session: 0, total: 0 } }),
    })
  );
  await page.route("**/api/projects/0/cost-history", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  );
  await page.route("**/api/projects/0/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    })
  );
  await page.route("**/api/projects/0/cost-start", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/projects/0/cost-snapshot", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
}

test.describe("Keyboard shortcuts (T052)", () => {
  // kbd hint badges were intentionally removed from controls/nav in commit
  // a05c1d0 (BL-061) — keyboard shortcuts still work, but the visual hint
  // chips no longer render. Skipping the badge-presence assertions.
  test.skip("kbd hint badges render on ControlsCard buttons", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(false)),
      })
    );
    await stubCommon(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Start button contains S kbd badge
    const startBtn = page.getByRole("button", { name: /^Start/ });
    await expect(startBtn.locator("kbd", { hasText: "S" })).toBeVisible();

    // Add Task button contains B kbd badge
    const addBtn = page.getByRole("button", { name: /Add task/i });
    await expect(addBtn.locator("kbd", { hasText: "B" })).toBeVisible();
  });

  test.skip("kbd hint badges GB/GH/GL render on nav tabs", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(false)),
      })
    );
    await stubCommon(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("link", { name: /^Tasks$/ }).locator("kbd", { hasText: "GB" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^History$/ }).locator("kbd", { hasText: "GH" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Live$/ }).locator("kbd", { hasText: "GL" })
    ).toBeVisible();
  });

  test("pressing 'x' on a running project triggers POST /stop", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(true)),
      })
    );
    await stubCommon(page);

    let stopCalled = false;
    await page.route("**/api/projects/0/stop", async (route) => {
      if (route.request().method() === "POST") {
        stopCalled = true;
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      } else {
        await route.continue();
      }
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    // Wait for Stop button to render so hook is mounted.
    await expect(page.getByRole("button", { name: /^Stop/ })).toBeVisible();

    await page.keyboard.press("x");
    await page.waitForTimeout(200);
    expect(stopCalled).toBe(true);
  });

  test("pressing 's' on an idle project triggers POST /start", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(false)),
      })
    );
    await stubCommon(page);

    let startCalled = false;
    await page.route("**/api/projects/0/start", async (route) => {
      if (route.request().method() === "POST") {
        startCalled = true;
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      } else {
        await route.continue();
      }
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^Start/ })).toBeVisible();

    await page.keyboard.press("s");
    await page.waitForTimeout(200);
    expect(startCalled).toBe(true);
  });

  test("pressing 'b' opens the Add Task dialog", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(false)),
      })
    );
    await stubCommon(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Add task/i })).toBeVisible();

    // Dialog not yet open
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Press 'b' — target body so event.target is not an input
    await page.locator("body").click();
    await page.keyboard.press("b");

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
  });

  test("'g' then 'b' chord navigates to tasks page", async ({ page }) => {
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail(false)),
      })
    );
    await page.route("**/api/projects/0/tasks**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], total: 0 } }),
      })
    );
    await stubCommon(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^Start/ })).toBeVisible();

    await page.locator("body").click();
    await page.keyboard.press("g");
    await page.keyboard.press("b");

    await page.waitForURL("**/project/0/tasks", { timeout: 5000 });
    expect(page.url()).toMatch(/\/project\/0\/tasks$/);
  });
});
