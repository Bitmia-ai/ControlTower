/**
 * E2E test for T122 — Task editing: description field is pre-populated.
 *
 * Validates the round-trip:
 * 1. Navigate to a task with a known description
 * 2. Click "Edit"
 * 3. Assert the description textarea is pre-populated (not blank)
 * 4. Change the description, click Save
 * 5. Assert the new description is visible in the read view
 *
 * Uses Playwright route interception to mock all API calls — no real
 * filesystem writes or RedEye instance required.
 */

import { test, expect } from "@playwright/test";

const ORIGINAL_DESCRIPTION = "Original description text from CEO request.";
const UPDATED_DESCRIPTION = "Updated description after edit.";

const TASK_DETAIL_INITIAL = {
  data: {
    id: "T999",
    title: "Sample task with description",
    type: "feature",
    priority: "P1",
    status: "pending",
    section: "ceo",
    description: ORIGINAL_DESCRIPTION,
    // No details field — proves we read from description, not details
  },
};

const TASK_DETAIL_UPDATED = {
  data: {
    id: "T999",
    title: "Sample task with description",
    type: "feature",
    priority: "P1",
    status: "pending",
    section: "ceo",
    description: UPDATED_DESCRIPTION,
  },
};

test.describe("T122 — Task edit description round-trip", () => {
  test("edit form pre-populates description and persists update", async ({
    page,
  }) => {
    let taskUpdated = false;

    await page.route("**/api/projects/0/tasks/T999", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(taskUpdated ? TASK_DETAIL_UPDATED : TASK_DETAIL_INITIAL),
        });
        return;
      }
      if (method === "PATCH") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        // Sanity: client must send `description`, not `details`
        expect(body.description).toBe(UPDATED_DESCRIPTION);
        expect(body.details).toBeUndefined();
        taskUpdated = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(TASK_DETAIL_UPDATED),
        });
        return;
      }
      await route.continue();
    });

    // Duration endpoint — task is not done, so we just stub a benign response
    await page.route("**/api/projects/0/tasks/T999/duration", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    });

    // SSE stream stub
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // 1. Navigate directly to the task detail page
    await page.goto("/project/0/tasks/T999", { waitUntil: "domcontentloaded" });

    // 2. Verify the read view shows the original description
    await expect(page.getByText(ORIGINAL_DESCRIPTION)).toBeVisible({
      timeout: 5000,
    });

    // 3. Click Edit
    await page.getByRole("button", { name: /^Edit$/ }).click();

    // 4. The description textarea must be pre-populated
    const textarea = page.getByPlaceholder(/Optional notes/);
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(ORIGINAL_DESCRIPTION);

    // 5. Change the description
    await textarea.fill(UPDATED_DESCRIPTION);

    // 6. Save
    await page.getByRole("button", { name: /^Save$/ }).click();

    // 7. Read view returns and shows the updated description
    await expect(page.getByText(UPDATED_DESCRIPTION)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(ORIGINAL_DESCRIPTION)).not.toBeVisible();
  });

  test("edit form falls back to details when description is missing", async ({
    page,
  }) => {
    const LEGACY_DETAILS = "- legacy bullet one\n- legacy bullet two";
    const TASK_LEGACY = {
      data: {
        id: "T998",
        title: "Legacy task without description",
        type: "feature",
        priority: "P2",
        status: "pending",
        section: "discovered",
        details: LEGACY_DETAILS,
        // No description field
      },
    };

    await page.route("**/api/projects/0/tasks/T998", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(TASK_LEGACY),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/projects/0/tasks/T998/duration", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    });

    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    await page.goto("/project/0/tasks/T998", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /^Edit$/ }).click();

    // Textarea should fall back to details when no description
    const textarea = page.getByPlaceholder(/Optional notes/);
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(LEGACY_DETAILS);
  });
});
