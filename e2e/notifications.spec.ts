/**
 * E2E tests for T113 — in-app notification system.
 *
 * Stubs GET /api/notifications and verifies:
 *   1. Toast appears within 10s of a new event arriving on a poll.
 *   2. Bell badge increments to "1".
 *   3. Clicking the bell opens the drawer with the item visible.
 *   4. Reload (after marking read) → badge gone (localStorage persists).
 *   5. Two polls in sequence → badge increments to 2.
 */
import { test, expect } from "@playwright/test";

function notification(overrides: Partial<{
  id: string;
  type: "task-complete" | "task-error" | "needs-input";
  projectId: number;
  projectName: string;
  message: string;
  timestamp: string;
  taskId: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "n1",
    type: overrides.type ?? "task-complete",
    projectId: overrides.projectId ?? 0,
    projectName: overrides.projectName ?? "haze",
    message: overrides.message ?? "T113 complete — merged to main",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    taskId: overrides.taskId ?? "T113",
  };
}

test.describe("In-app notification system (T113)", () => {
  test("toast and bell badge appear when a new event arrives", async ({ page }) => {
    let pollCount = 0;
    await page.route("**/api/notifications**", async (route) => {
      pollCount += 1;
      // First poll: empty (initial). Second+ polls: 1 event.
      const items = pollCount === 1 ? [] : [notification({ id: "evt-1" })];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { notifications: items } }),
      });
    });

    // Avoid hitting other routes that may not be ready.
    await page.route("**/api/projects", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Toast should surface within ~10s of the next poll tick.
    await expect(page.getByText("T113 complete — merged to main")).toBeVisible({ timeout: 12_000 });

    // Bell badge should read "1"
    const badge = page.getByTestId("notification-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("1");

    // Clicking the bell opens the drawer with the item visible.
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-drawer")).toBeVisible();
    await expect(page.getByText("T113 complete — merged to main").first()).toBeVisible();
  });

  test("badge clears across reload after drawer open marks read", async ({ page }) => {
    await page.route("**/api/notifications**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { notifications: [notification({ id: "persist-1" })] } }),
      }),
    );
    await page.route("**/api/projects", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Open drawer → marks read.
    await page.getByTestId("notification-bell").click();
    await expect(page.getByTestId("notification-drawer")).toBeVisible();

    // Reload — badge should be hidden because localStorage remembers the read id.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("notification-badge")).toBeHidden();
  });

  test("badge increments to 2 when a second event arrives", async ({ page }) => {
    let pollCount = 0;
    await page.route("**/api/notifications**", async (route) => {
      pollCount += 1;
      let items: ReturnType<typeof notification>[] = [];
      if (pollCount >= 2) items = [notification({ id: "a" })];
      if (pollCount >= 3) items = [notification({ id: "a" }), notification({ id: "b", message: "T200 complete — merged to main" })];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { notifications: items } }),
      });
    });
    await page.route("**/api/projects", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const badge = page.getByTestId("notification-badge");
    // 1 first
    await expect(badge).toHaveText("1", { timeout: 12_000 });
    // 2 after another poll
    await expect(badge).toHaveText("2", { timeout: 12_000 });
  });
});
