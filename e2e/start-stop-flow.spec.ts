/**
 * E2E tests for Start/Stop flow (T003)
 *
 * Uses Playwright route interception to mock the start/stop/project APIs,
 * avoiding real Claude process spawning.
 */

import { test, expect } from "@playwright/test";

const PROJECT_DETAIL_STOPPED = {
  data: {
    project: {
      name: "haze",
      path: "/tmp/haze",
      initialized: true,
      running: false,
      sessionStatus: { cto: { status: "stopped", pid: null, lastActivity: null } },
    },
    state: {
      iteration: 10,
      phase: "TRIAGE",
      phase_status: "pending",
      task_id: null,
      task_title: null,
      health: { confidence: "HIGH", env_status: "healthy", iterations_since_last_deploy: 0, questions_awaiting_ceo: 0, blocked_items_count: 0 },
    },
    tasks: [],
    questions: [],
  },
};

const PROJECT_DETAIL_RUNNING = {
  data: {
    ...PROJECT_DETAIL_STOPPED.data,
    project: {
      ...PROJECT_DETAIL_STOPPED.data.project,
      running: true,
      sessionStatus: { cto: { status: "running", pid: 12345, lastActivity: Date.now() } },
    },
    state: {
      ...PROJECT_DETAIL_STOPPED.data.state,
      phase: "BUILD",
      phase_status: "pending",
      task_id: "T007",
      task_title: "Add widget support",
    },
  },
};

test.describe("Start/Stop flow", () => {
  test("Start button transitions to Stop, then back to idle", async ({ page }) => {
    let isRunning = false;

    // Mock project detail API — returns running or stopped based on state
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(isRunning ? PROJECT_DETAIL_RUNNING : PROJECT_DETAIL_STOPPED),
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
        body: JSON.stringify({ data: { session: 0.5, total: 10.0 } }),
      });
    });

    // Mock start API — sets running state
    await page.route("**/api/projects/0/start", async (route) => {
      isRunning = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "running", pid: 12345 } }),
      });
    });

    // Mock stop API — clears running state
    await page.route("**/api/projects/0/stop", async (route) => {
      isRunning = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { success: true } }),
      });
    });

    // Mock stream SSE to prevent hanging connections
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: "data: {}\n\n" });
    });

    // 1. Navigate to project mission control
    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // 2. Verify Start button is visible
    const startBtn = page.getByRole("button", { name: "Start" });
    await expect(startBtn).toBeVisible();

    // 3. Verify idle state — "RedEye is idle" text
    await expect(page.getByText("RedEye is idle")).toBeVisible();

    // 4. Click Start
    await startBtn.click();
    await page.waitForTimeout(800);

    // 5. Verify Stop button appears (exact match — there's also a "More
    //    stop options" chevron button in the same group)
    const stopBtn = page.getByRole("button", { name: "Stop", exact: true });
    await expect(stopBtn).toBeVisible();

    // 6. Verify Working On card shows the task — use first() because the
    //    title also appears in the phase-change toast.
    await expect(page.getByText("Add widget support").first()).toBeVisible();

    // 7. Click Stop
    await stopBtn.click();
    await page.waitForTimeout(800);

    // 8. Verify Start button returns
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

    // 9. Verify UI returns to idle
    await expect(page.getByText("RedEye is idle")).toBeVisible();
  });
});
