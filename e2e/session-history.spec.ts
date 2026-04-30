/**
 * E2E tests for T053 — session history page with phase timeline.
 *
 * Verifies:
 *   - "Sessions" heading renders
 *   - Mocked session-history payload renders one row per session
 *   - PhaseChip short labels render for each session's phases
 *   - Cost badge renders with the formatted cost value
 *
 * T123: Iteration Log section removed from History tab (changelog.md only
 * contained stale BL-* entries from early iterations and was never updated).
 */

import { test, expect } from "@playwright/test";

const SESSION_HISTORY = {
  data: {
    sessions: [
      {
        file: "session-a.jsonl",
        cost: 1.42,
        mtimeMs: Date.parse("2026-04-25T15:42:00Z"),
        startedAt: Date.parse("2026-04-25T14:00:00Z"),
        durationMs: 102 * 60 * 1000,
        phases: ["TRIAGE", "PLAN", "BUILD"],
      },
      {
        file: "session-b.jsonl",
        cost: 0.55,
        mtimeMs: Date.parse("2026-04-24T11:00:00Z"),
        startedAt: Date.parse("2026-04-24T10:30:00Z"),
        durationMs: 30 * 60 * 1000,
        phases: ["REVIEW", "DEPLOY"],
      },
      {
        file: "session-c.jsonl",
        cost: 2.18,
        mtimeMs: Date.parse("2026-04-23T18:30:00Z"),
        startedAt: Date.parse("2026-04-23T17:00:00Z"),
        durationMs: 90 * 60 * 1000,
        phases: ["BUILD"],
      },
    ],
  },
};

test.describe("Session history page (T053)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/projects/0/session-history**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_HISTORY),
      })
    );
  });

  test("renders Sessions heading", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    // Sessions section landmark is present.
    await expect(page.locator("section[aria-label='Sessions']").first()).toBeAttached();
    // Iteration Log section was removed in T123 — assert it is gone.
    await expect(
      page.locator("section[aria-label='Iteration Log']")
    ).not.toBeAttached();
  });

  test("renders one row per mocked session with phase flow labels", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    const sessionsRegion = page.locator("section[aria-label='Sessions']").first();
    await expect(sessionsRegion).toBeAttached();

    // Collapsed rows show plain-English phase flow ("Triage → Plan → Build")
    // — short PhaseChip labels (TRI/PLN/BLD/...) live in the expanded panel
    // only. Assert at least one row's flow text is present for each
    // mocked session.
    await expect(
      sessionsRegion.getByText("Triage → Plan → Build")
    ).toBeVisible();
    await expect(sessionsRegion.getByText("Review → Deploy")).toBeVisible();
    await expect(sessionsRegion.getByText("Build", { exact: true })).toBeVisible();
  });

  test("renders cost badges for each session", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("$1.42").first()).toBeVisible();
    await expect(page.getByText("$0.55").first()).toBeVisible();
    await expect(page.getByText("$2.18").first()).toBeVisible();
  });

  test("shows empty state when no sessions returned", async ({ page }) => {
    await page.unroute("**/api/projects/0/session-history**");
    await page.route("**/api/projects/0/session-history**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { sessions: [] } }),
      })
    );

    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/No sessions found/i)).toBeVisible();
    // Iteration Log section is gone (T123).
    await expect(
      page.locator("section[aria-label='Iteration Log']")
    ).not.toBeAttached();
  });
});
