/**
 * E2E test for cost forecasting (T117)
 *
 * Verifies that when /cost-forecast returns sessions + projection data, the
 * Cost card shows the burn-rate row, 24h/7d estimate rows, and the new
 * CostTrendChart SVG with the projected polyline.
 *
 * Uses Playwright route interception to mock all API calls.
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

const ONE_DAY = 86_400_000;
const baseTime = Date.UTC(2026, 3, 20);

const fiveSessions = [
  { file: "s1.jsonl", cost: 0.5, mtimeMs: baseTime },
  { file: "s2.jsonl", cost: 0.6, mtimeMs: baseTime + ONE_DAY },
  { file: "s3.jsonl", cost: 0.7, mtimeMs: baseTime + 2 * ONE_DAY },
  { file: "s4.jsonl", cost: 0.8, mtimeMs: baseTime + 3 * ONE_DAY },
  { file: "s5.jsonl", cost: 0.9, mtimeMs: baseTime + 4 * ONE_DAY },
];

const projection = [
  { sessionIndex: 5, cost: 0.7 },
  { sessionIndex: 6, cost: 0.7 },
  { sessionIndex: 7, cost: 0.7 },
  { sessionIndex: 8, cost: 0.7 },
  { sessionIndex: 9, cost: 0.7 },
];

async function mockCommonRoutes(page: import("@playwright/test").Page) {
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
      body: JSON.stringify({ data: { session: 0.9, total: 3.5 } }),
    });
  });

  await page.route("**/api/projects/0/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    });
  });
}

test.describe("Cost forecasting (T117)", () => {
  test("renders burn rate, forecast rows, and trend chart with projection", async ({ page }) => {
    await mockCommonRoutes(page);

    await page.route("**/api/projects/0/cost-forecast", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            sessions: fiveSessions,
            burnRatePerSession: 0.7,
            trend: "accelerating",
            forecast24h: 2.1,
            forecast7d: 14.7,
            sessionsPerDay: 3,
            projectedSessions: projection,
          },
        }),
      });
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Cost card visible
    await expect(page.getByText("Cost", { exact: true })).toBeVisible({ timeout: 5000 });

    // Burn rate row visible with the trend value text
    await expect(page.getByText("Burn Rate")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("$0.70/session")).toBeVisible();

    // Forecast rows
    await expect(page.getByText("Est. 24h")).toBeVisible();
    await expect(page.getByText("$2.10")).toBeVisible();
    await expect(page.getByText("Est. 7d")).toBeVisible();
    await expect(page.getByText("$14.70")).toBeVisible();

    // Trend chart SVG with projection polyline
    const chart = page.locator("svg[data-testid='cost-trend-chart']");
    await expect(chart).toBeVisible();
    await expect(chart.locator("polyline[data-testid='trend-projection']")).toHaveCount(1);

    // Caption mentions projection
    await expect(page.getByText(/Last \d+ sessions \+ 5 projected/)).toBeVisible();
  });

  test("hides forecast rows and trend chart when forecast endpoint fails", async ({ page }) => {
    await mockCommonRoutes(page);

    await page.route("**/api/projects/0/cost-forecast", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{\"error\":\"x\"}" });
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Cost", { exact: true })).toBeVisible({ timeout: 5000 });
    // Session/Total rows still render
    await expect(page.getByText(/^Session$/)).toBeVisible();
    await expect(page.getByText(/^Total$/)).toBeVisible();
    // Forecast UI does NOT render
    await expect(page.locator("svg[data-testid='cost-trend-chart']")).toHaveCount(0);
    await expect(page.getByText("Burn Rate")).toHaveCount(0);
    await expect(page.getByText("Est. 24h")).toHaveCount(0);
  });
});
