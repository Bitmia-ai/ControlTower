/**
 * E2E test for the velocity chart (T118)
 *
 * Verifies that when /api/projects/[id]/velocity returns weekly buckets and
 * trend data, the Mission Control right rail shows a Velocity card with the
 * trend badge, avg-tasks-per-week summary, and the bar+line SVG chart.
 *
 * Uses Playwright route interception so the test does not depend on the
 * real .redeye/tasks.md state of any registered project.
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

const fourteenWeeks = Array.from({ length: 14 }, (_, i) => {
  // Fixed Sunday dates starting 2026-01-04 + 7*i days.
  const start = new Date("2026-01-04T12:00:00Z");
  const d = new Date(start.getTime() + i * 7 * 86_400_000);
  const counts = [0, 1, 2, 1, 3, 2, 1, 4, 5, 3, 2, 4, 5, 1];
  return {
    weekStart: d.toISOString().slice(0, 10),
    count: counts[i],
    rollingAvg: counts[i] * 0.75,
    isCurrentWeek: i === 13,
  };
});

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
      body: JSON.stringify({ data: { session: 0.5, total: 1.5 } }),
    });
  });

  await page.route("**/api/projects/0/cost-forecast", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"x"}' });
  });

  await page.route("**/api/projects/0/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {}\n\n",
    });
  });
}

test.describe("Velocity chart (T118)", () => {
  test("renders trend badge, avg-tasks-per-week summary, and the SVG chart", async ({
    page,
  }) => {
    await mockCommonRoutes(page);

    await page.route("**/api/projects/0/velocity", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            weeks: fourteenWeeks,
            avgTasksPerWeek: 2.6,
            trend: "up",
            totalCompletedWithDate: 34,
          },
        }),
      });
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Velocity card visible
    await expect(page.getByText("Velocity", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Trend badge — 'Up' value visible
    const badge = page.locator("[data-testid='velocity-trend-badge']");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("data-trend", "up");

    // Summary row
    await expect(page.getByText(/2\.6 tasks\/week/)).toBeVisible();

    // SVG chart with rolling-average polyline
    const chart = page.locator("svg[data-testid='velocity-chart']");
    await expect(chart).toBeVisible();
    await expect(
      chart.locator("polyline[data-testid='velocity-rolling-avg']")
    ).toHaveCount(1);
  });

  test("shows 'Velocity data unavailable' when the velocity endpoint fails", async ({
    page,
  }) => {
    await mockCommonRoutes(page);

    await page.route("**/api/projects/0/velocity", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"error":"boom"}',
      });
    });

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Velocity", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/Velocity data unavailable/i)).toBeVisible();
    await expect(page.locator("svg[data-testid='velocity-chart']")).toHaveCount(
      0
    );
  });
});
