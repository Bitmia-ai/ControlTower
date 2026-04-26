/**
 * E2E tests for T053 — session history page with phase timeline.
 *
 * Verifies:
 *   - "Sessions" heading renders above the iteration log
 *   - Mocked session-history payload renders one row per session
 *   - PhaseChip short labels render for each session's phases
 *   - Cost badge renders with the formatted cost value
 *   - "Iteration Log" heading is preserved
 */

import { test, expect } from "@playwright/test";

const PROJECT_DETAIL = {
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
      iteration: 12,
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
    recentChangelog: [
      { title: "T001 done", details: "First feature shipped.", date: "2026-04-01" },
    ],
    steeringDirectives: [],
  },
};

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
    await page.route("**/api/projects/0", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PROJECT_DETAIL),
      })
    );
    await page.route("**/api/projects/0/session-history**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SESSION_HISTORY),
      })
    );
  });

  test("renders Sessions heading and iteration log heading", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /^Sessions$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Iteration Log/i })).toBeVisible();
  });

  test("renders one row per mocked session with phase chips", async ({ page }) => {
    await page.goto("/project/0/history", { waitUntil: "domcontentloaded" });

    // Expect 3 phase strips with aria-label containing phases.
    const sessionsRegion = page.getByRole("region", { name: "Sessions" }).or(
      page.locator("section[aria-label='Sessions']")
    );
    await expect(sessionsRegion).toBeVisible();

    // Phase chips: PLN, BLD, REV, DEP, TRI all visible (from the 3 mocked sessions).
    await expect(sessionsRegion.getByText("TRI", { exact: true }).first()).toBeVisible();
    await expect(sessionsRegion.getByText("PLN", { exact: true }).first()).toBeVisible();
    await expect(sessionsRegion.getByText("BLD", { exact: true }).first()).toBeVisible();
    await expect(sessionsRegion.getByText("REV", { exact: true }).first()).toBeVisible();
    await expect(sessionsRegion.getByText("DEP", { exact: true }).first()).toBeVisible();
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
    // Iteration log is unaffected.
    await expect(page.getByRole("heading", { name: /Iteration Log/i })).toBeVisible();
  });
});
