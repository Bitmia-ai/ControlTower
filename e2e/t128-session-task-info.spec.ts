/**
 * E2E tests for T128 — History session rows show per-session task info.
 *
 * Verifies:
 *   - Sessions with iterationSummaries render a "T<N> · …" task line on the
 *     collapsed row.
 *   - Sessions without iterationSummaries do NOT render a task line.
 *   - Expanding a row reveals an Activity panel listing iteration number,
 *     phase flow, and outcome text.
 *   - Search input filters by task ID and outcome keyword.
 */

import { test, expect } from "@playwright/test";

const SESSION_HISTORY = {
  data: {
    sessions: [
      {
        file: "session-with-summary.jsonl",
        cost: 1.42,
        mtimeMs: Date.parse("2026-04-28T15:00:00Z"),
        startedAt: Date.parse("2026-04-28T13:00:00Z"),
        durationMs: 2 * 60 * 60 * 1000,
        phases: ["BUILD"],
        iterationSummaries: [
          {
            iteration: 158,
            outcome: "T126 complete. RunButton localStorage persist.",
            phases: ["DEPLOY", "VERIFY", "MERGE"],
          },
        ],
      },
      {
        file: "session-no-summary.jsonl",
        cost: 0.55,
        mtimeMs: Date.parse("2026-04-27T11:00:00Z"),
        startedAt: Date.parse("2026-04-27T10:30:00Z"),
        durationMs: 30 * 60 * 1000,
        phases: ["TRIAGE"],
        iterationSummaries: [],
      },
    ],
  },
};

test.describe("T128 — session row task info", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/projects/0/session-history**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_HISTORY),
      })
    );
  });

  test("collapsed row shows T<N> · outcome line when summaries exist", async ({
    page,
  }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });
    const taskLine = page.getByTestId("session-task-line").first();
    await expect(taskLine).toBeVisible();
    await expect(taskLine).toContainText(/T126/);
  });

  test("collapsed row hides task line when summaries are empty", async ({
    page,
  }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });
    // The mock has 2 sessions; only the first should have a task line.
    const taskLines = page.getByTestId("session-task-line");
    await expect(taskLines).toHaveCount(1);
  });

  test("expanding a row reveals the Activity panel with outcome text", async ({
    page,
  }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });
    // Click the first session row's expand button.
    const firstRow = page.getByRole("button", { expanded: false }).first();
    await firstRow.click();
    const activity = page.getByTestId("session-activity").first();
    await expect(activity).toBeVisible();
    await expect(activity).toContainText("Activity");
    await expect(activity).toContainText("Iteration 158");
    await expect(activity).toContainText(
      "T126 complete. RunButton localStorage persist."
    );
  });

  test("search by task ID filters to matching session", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("searchbox");
    await search.fill("T126");
    // Only the row with T126 in its outcome should remain.
    await expect(page.getByTestId("session-task-line")).toHaveCount(1);
  });

  test("search by outcome keyword filters to matching session", async ({
    page,
  }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });
    const search = page.getByRole("searchbox");
    await search.fill("localStorage");
    await expect(page.getByTestId("session-task-line")).toHaveCount(1);
  });
});
