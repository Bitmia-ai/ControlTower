/**
 * E2E tests for mission-control card sizing (T062)
 *
 * Verifies:
 *   1. The grid uses md:items-start so cards no longer stretch to equal-height.
 *   2. Row-1 (WorkingOn + Controls) wrappers have a min-height floor of 120px on desktop.
 *   3. The sparkline SVG renders with preserveAspectRatio="xMidYMid meet" and no fixed
 *      `height` attribute (it scales proportionally).
 *   4. The sparkline container caps growth at max-h-[72px].
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

const SPARKLINE_HISTORY = {
  data: {
    sessions: [
      { file: "a.jsonl", cost: 0.3, mtimeMs: 1714000000000 },
      { file: "b.jsonl", cost: 0.5, mtimeMs: 1714086400000 },
      { file: "c.jsonl", cost: 0.4, mtimeMs: 1714172800000 },
      { file: "d.jsonl", cost: 0.7, mtimeMs: 1714259200000 },
    ],
  },
};

async function setupMocks(page: import("@playwright/test").Page) {
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
      body: JSON.stringify({ data: { session: 0.5, total: 5.0 } }),
    });
  });

  await page.route("**/api/projects/0/cost-history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SPARKLINE_HISTORY),
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

// These tests describe a layout that no longer exists. The original T062
// design used a uniform `md:items-start` grid with `md:min-h-[120px]`
// row-1 wrappers and an embedded SparklineChart in CostCard.
// The current mission-control layout uses an asymmetric two-column command
// layout (T067) with no min-height floor, and CostCard embeds CostTrendChart
// instead of SparklineChart — the sparkline component is unused.
// Skipping to avoid false-positive regressions. See T120 cycle 2 BUILD notes.
test.describe.skip("Mission control card sizing (T062 — legacy layout, retired)", () => {
  test("row-1 wrappers have min-height floor of at least 120px on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMocks(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Wait for the controls card to render (proves data loaded).
    await expect(page.getByText("Controls", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    const workingOnHeading = page.getByText("Working On", { exact: true });
    await expect(workingOnHeading).toBeVisible();

    // The wrapper div around each card holds the min-h class. Walk up from
    // the heading: heading -> card root (rounded-lg p-5) -> wrapper.
    const workingOnWrapper = workingOnHeading.locator("xpath=ancestor::div[contains(@class,'md:min-h-[120px]')]");
    await expect(workingOnWrapper).toHaveCount(1);
    const workingOnBox = await workingOnWrapper.boundingBox();
    expect(workingOnBox?.height).toBeGreaterThanOrEqual(120);

    const controlsHeading = page.getByText("Controls", { exact: true });
    const controlsWrapper = controlsHeading.locator("xpath=ancestor::div[contains(@class,'md:min-h-[120px]')]");
    await expect(controlsWrapper).toHaveCount(1);
    const controlsBox = await controlsWrapper.boundingBox();
    expect(controlsBox?.height).toBeGreaterThanOrEqual(120);
  });

  test("grid uses md:items-start to prevent equal-height stretching", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMocks(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Controls", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // The grid container has md:items-start.
    const grid = page.locator("div.grid.md\\:items-start").first();
    await expect(grid).toHaveCount(1);
  });

  test("sparkline SVG uses meet preserveAspectRatio and has no fixed height attribute", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMocks(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    const sparkline = page.locator("svg[data-testid='sparkline']");
    await expect(sparkline).toBeVisible({ timeout: 5000 });

    const aspect = await sparkline.getAttribute("preserveAspectRatio");
    expect(aspect).toBe("xMidYMid meet");

    const heightAttr = await sparkline.getAttribute("height");
    expect(heightAttr).toBeNull();
  });

  test("sparkline container caps height at 72px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupMocks(page);
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    const sparkline = page.locator("svg[data-testid='sparkline']");
    await expect(sparkline).toBeVisible({ timeout: 5000 });

    // Sparkline wrapper is the immediate parent <div>.
    const wrapper = sparkline.locator("xpath=..");
    const cls = await wrapper.getAttribute("class");
    expect(cls ?? "").toContain("max-h-[72px]");
    expect(cls ?? "").toContain("overflow-hidden");

    const box = await wrapper.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(72);
  });
});
