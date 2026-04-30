import { test, expect } from "@playwright/test";

/**
 * Smoke checks for the UI redesign. Verifies that the key surfaces
 * (TopBar, home dashboard, project shell, mobile tab bar, /activity,
 * /inbox) render the expected hooks. Network is stubbed so the spec
 * doesn't depend on a real RedEye loop.
 */

const PROJECTS_FIXTURE = [
  {
    name: "haze",
    path: "/tmp/haze",
    initialized: true,
    running: false,
    phase: "TRIAGE",
    currentTask: null,
    taskId: null,
    taskTitle: null,
    questionCount: 0,
    backlogCount: 1,
    doneCount: 0,
    scheduleEnabled: false,
    scheduleSummary: null,
  },
  {
    name: "ctowr",
    path: "/tmp/ctowr",
    initialized: true,
    running: true,
    phase: "BUILD",
    currentTask: "T1 hello world",
    taskId: "T1",
    taskTitle: "hello world",
    questionCount: 1,
    backlogCount: 3,
    doneCount: 42,
    scheduleEnabled: true,
    scheduleSummary: "every 7 days",
  },
];

const INBOX_FIXTURE = [
  {
    uid: "1:Q-1",
    projectIndex: 1,
    projectName: "ctowr",
    projectPath: "/tmp/ctowr",
    question: {
      id: "Q-1",
      question: "Retry 503s with exponential backoff?",
      answered: false,
      context: "Two upstream services return 503 under load.",
    },
  },
];

const ACTIVITY_FIXTURE = [
  {
    uid: "1:0",
    projectIndex: 1,
    projectName: "ctowr",
    title: "T42 ship the demo gif",
    details: "Recorded a 12s capture of the dashboard onboarding flow.",
    date: "2026-04-29",
  },
];

async function stubFleet(page: import("@playwright/test").Page) {
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: PROJECTS_FIXTURE }),
    });
  });
  await page.route("**/api/inbox", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: INBOX_FIXTURE }),
    });
  });
  await page.route("**/api/activity", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: ACTIVITY_FIXTURE }),
    });
  });
  await page.route("**/api/notifications**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { notifications: [] } }),
    });
  });
}

test.describe("redesign smoke", () => {
  test("home renders TopBar + fleet summary + project cards", async ({ page }) => {
    await stubFleet(page);
    await page.goto("/");

    // TopBar — logo link + "on RedEye" tagline + activity icon link
    await expect(
      page.getByRole("link", { name: /control tower/i })
    ).toBeVisible();
    await expect(page.getByText(/on redeye/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /activity/i })).toBeVisible();

    // Page heading reflects "X projects · N need you"
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toContainText(/2 projects/i);

    // Project cards render their names and the new redesign labels
    await expect(page.getByRole("heading", { name: "haze" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ctowr" })).toBeVisible();
    await expect(page.getByText("Backlog").first()).toBeVisible();
    await expect(page.getByText("Done").first()).toBeVisible();

    // Inbox card surfaces the federated question
    await expect(page.getByText(/needs your input/i)).toBeVisible();
    await expect(
      page.getByText(/retry 503s with exponential backoff/i)
    ).toBeVisible();
  });

  test("activity link goes to /activity and shows shipped feed", async ({ page }) => {
    await stubFleet(page);
    await page.goto("/");
    await page.getByRole("link", { name: /activity/i }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(
      page.getByRole("heading", { name: /^activity$/i })
    ).toBeVisible();
    await expect(page.getByText(/T42 ship the demo gif/i)).toBeVisible();
  });

  test("/inbox renders the global question feed", async ({ page }) => {
    await stubFleet(page);
    await page.goto("/inbox");
    await expect(
      page.getByRole("heading", { name: /^inbox$/i })
    ).toBeVisible();
    await expect(
      page.getByText(/retry 503s with exponential backoff/i)
    ).toBeVisible();
  });

  test("project shell shows 3 tabs with backlog badge", async ({ page }) => {
    await stubFleet(page);
    // Per-project endpoint is also hit by the shell + Now view.
    await page.route("**/api/projects/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            project: PROJECTS_FIXTURE[1],
            state: { phase: "BUILD", task_id: "T1", task_title: "hello world", health: { blocked_items_count: 0 } },
            currentTask: "T1 hello world",
            activeItem: { id: "T1", title: "hello world", status: "in-progress" },
            pendingQuestions: [],
            upNext: [
              { id: "T2", title: "next thing", status: "pending" },
              { id: "T3", title: "another", status: "planned" },
              { id: "T4", title: "third", status: "planned" },
            ],
            recentlyShipped: [],
            allDoneItems: Array.from({ length: 42 }, (_, i) => ({
              id: `T${100 + i}`,
              title: `done ${i}`,
              status: "done",
            })),
            wontDoItems: [],
            recentChangelog: [],
            steeringDirectives: [],
          },
        }),
      });
    });
    await page.route("**/api/projects/1/schedules", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { schedules: [] } }),
      });
    });

    await page.goto("/project/1");
    // The shell renders the back link, project name, and 3 tabs
    await expect(page.getByRole("button", { name: /all projects/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ctowr" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Now/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Tasks/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^History/ })).toBeVisible();
  });

  test("mobile bottom tab bar is hidden on desktop, visible on mobile", async ({
    page,
  }) => {
    await stubFleet(page);
    // Desktop viewport: tab bar hidden via .mobile-only.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const desktopBottomNav = page.getByRole("navigation", {
      name: /bottom navigation/i,
    });
    await expect(desktopBottomNav).toBeHidden();

    // Mobile viewport: same DOM, now visible.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopBottomNav).toBeVisible();
    await expect(desktopBottomNav.getByText(/^home$/i)).toBeVisible();
    await expect(desktopBottomNav.getByText(/^inbox$/i)).toBeVisible();
  });
});
