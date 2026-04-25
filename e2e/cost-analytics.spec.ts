/**
 * E2E test for the Cost analytics sparkline (BL-051)
 *
 * Verifies that when the cost-history endpoint returns 2+ sessions,
 * the SVG sparkline and "Last N sessions" label render in the DOM.
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

test.describe("Cost analytics sparkline (BL-051)", () => {
  test("renders sparkline SVG when cost-history returns 5 sessions", async ({ page }) => {
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

    // Mock cost scalars
    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0.75, total: 3.20 } }),
      });
    });

    // Mock cost-history with 5 sessions of varying costs
    const baseTime = Date.UTC(2026, 3, 20);
    const sessions = [
      { file: "s1.jsonl", cost: 0.10, mtimeMs: baseTime },
      { file: "s2.jsonl", cost: 0.45, mtimeMs: baseTime + 86_400_000 },
      { file: "s3.jsonl", cost: 0.30, mtimeMs: baseTime + 2 * 86_400_000 },
      { file: "s4.jsonl", cost: 0.85, mtimeMs: baseTime + 3 * 86_400_000 },
      { file: "s5.jsonl", cost: 0.75, mtimeMs: baseTime + 4 * 86_400_000 },
    ];
    await page.route("**/api/projects/0/cost-history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { sessions } }),
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

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Cost card should appear
    await expect(page.getByText("Cost", { exact: true })).toBeVisible({ timeout: 5000 });

    // Sparkline SVG should be present
    const sparkline = page.locator("svg[data-testid='sparkline']");
    await expect(sparkline).toBeVisible({ timeout: 5000 });

    // Label should match session count
    await expect(page.getByText("Last 5 sessions")).toBeVisible();

    // Polyline should be inside the sparkline svg
    await expect(sparkline.locator("polyline")).toHaveCount(1);
  });

  test("does not render sparkline when cost-history returns fewer than 2 sessions", async ({
    page,
  }) => {
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
        body: JSON.stringify({ data: { session: 0.10, total: 0.10 } }),
      });
    });

    await page.route("**/api/projects/0/cost-history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { sessions: [] } }),
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

    // Cost card visible
    await expect(page.getByText("Cost", { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/this session \(est\.\)/i)).toBeVisible();

    // Sparkline should NOT be present
    await expect(page.locator("svg[data-testid='sparkline']")).toHaveCount(0);
  });
});
