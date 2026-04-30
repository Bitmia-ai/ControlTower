/**
 * E2E tests for T050 — phase-change toast notifications.
 *
 * Verifies that when the mission-control polling loop reports a new phase,
 * an in-app toast appears in the DOM. Uses Playwright route interception
 * to flip the phase between successive polls.
 */

import { test, expect } from "@playwright/test";

function detail(phase: string, task_title: string | null) {
  return {
    data: {
      project: {
        name: "haze",
        path: "/tmp/haze",
        initialized: true,
        running: true,
        hasTranscript: false,
        sessionStatus: { cto: { status: "running", pid: 1234, lastActivity: Date.now() } },
      },
      state: {
        iteration: 10,
        phase,
        phase_status: "in-progress",
        task_id: "T100",
        task_title,
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

test.describe("Phase-change toast notifications (T050)", () => {
  test("toast appears when phase transitions PLAN -> BUILD via polling", async ({
    page,
  }) => {
    let pollCount = 0;

    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        pollCount += 1;
        // First poll = PLAN (baseline). Subsequent polls = BUILD.
        const phase = pollCount === 1 ? "PLAN" : "BUILD";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail(phase, "Test feature")),
        });
      } else {
        await route.continue();
      }
    });

    // Mock cost + sse + cost-start + cost-forecast + velocity to avoid
    // hitting the real prod server, which can introduce timing variance.
    await page.route("**/api/projects/0/cost", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
      })
    );
    await page.route("**/api/projects/0/cost-forecast", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      })
    );
    await page.route("**/api/projects/0/velocity", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
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

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // First render: PLAN — no toast
    await expect(page.getByText(/RedEye entered BUILD/)).toBeHidden({ timeout: 1000 });

    // Polling fires every 5s — wait for the next poll (BUILD) and toast.
    // Toasts auto-dismiss after 5s; "Test feature" stays in the WorkingOn
    // card. Verify the WorkingOn task line first (which never disappears),
    // then the toast (with a generous window) — this way the test is robust
    // even if the toast briefly flashes during the assertion polling.
    await expect(page.getByText(/Test feature/).first()).toBeVisible({
      timeout: 20_000,
    });
    const toast = page.getByText(/RedEye entered BUILD phase/);
    await expect(toast).toBeVisible({ timeout: 20_000 });
  });

  test("no toast appears on initial page load even if phase is BUILD", async ({
    page,
  }) => {
    // Always serve BUILD — should not toast on first observation.
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail("BUILD", "Already building")),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/projects/0/cost", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
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

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    // Wait long enough for several polls — the phase never changes, so no toast.
    await page.waitForTimeout(7_000);
    await expect(page.getByText(/RedEye entered BUILD phase/)).toBeHidden();
  });

  test("toast does NOT appear for low-signal transitions (PLAN -> TRIAGE)", async ({
    page,
  }) => {
    let pollCount = 0;
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        pollCount += 1;
        const phase = pollCount === 1 ? "PLAN" : "TRIAGE";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail(phase, "Low signal")),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/projects/0/cost", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
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

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(7_000);

    await expect(page.getByText(/RedEye entered TRIAGE/)).toBeHidden();
    await expect(page.getByText(/RedEye entered PLAN/)).toBeHidden();
  });

  test("clicking the toast navigates to the live tab", async ({ page }) => {
    let pollCount = 0;
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        pollCount += 1;
        const phase = pollCount === 1 ? "PLAN" : "REVIEW";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail(phase, "Reviewable")),
        });
      } else {
        await route.continue();
      }
    });
    await page.route("**/api/projects/0/cost", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
      })
    );
    await page.route("**/api/projects/0/cost-forecast", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      })
    );
    await page.route("**/api/projects/0/velocity", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
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

    await page.goto("/project/0", { waitUntil: "domcontentloaded" });

    const toastLink = page.getByRole("link", { name: /RedEye entered REVIEW/ });
    await expect(toastLink).toBeVisible({ timeout: 20_000 });
    await expect(toastLink).toHaveAttribute("href", "/project/0/live");
  });
});
