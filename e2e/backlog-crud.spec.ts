/**
 * E2E tests for Backlog CRUD flow (BL-049)
 *
 * Tests adding a backlog item via the AddBacklogDialog, verifying it appears
 * in the list, navigating to the detail page, and confirming fields render.
 *
 * Uses Playwright route interception to mock all API calls — no real
 * filesystem writes or server required.
 */

import { test, expect } from "@playwright/test";

interface MinimalBacklogItem {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  section: string;
  details: string;
}

interface MinimalProjectDetail {
  data: {
    project: {
      name: string;
      path: string;
      initialized: boolean;
      running: boolean;
      hasTranscript: boolean;
      sessionStatus: { cto: { status: string; pid: null; lastActivity: null } };
    };
    state: {
      iteration: number;
      phase: string;
      phase_status: string;
      backlog_item: null;
      backlog_title: null;
      health: {
        confidence: string;
        env_status: string;
        iterations_since_last_deploy: number;
        questions_awaiting_ceo: number;
        blocked_items_count: number;
      };
    };
    currentTask: null;
    activeItem: null;
    pendingQuestions: unknown[];
    upNext: MinimalBacklogItem[];
    recentlyShipped: unknown[];
    recentChangelog: unknown[];
    steeringDirectives: unknown[];
  };
}

const MINIMAL_PROJECT_DETAIL: MinimalProjectDetail = {
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
      iteration: 10,
      phase: "TRIAGE",
      phase_status: "complete",
      backlog_item: null,
      backlog_title: null,
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

const NEW_ITEM_DETAIL = {
  data: {
    id: "BL-001",
    title: "My new test task",
    type: "feature",
    priority: "P1",
    status: "pending",
    section: "ceo",
    details: "",
    added: "2026-04-25",
  },
};

test.describe("Backlog CRUD (BL-049)", () => {
  test("add a task via dialog, verify it appears in list, navigate to detail", async ({
    page,
  }) => {
    let itemAdded = false;

    // Mock project detail — returns the new item in upNext after POST
    await page.route("**/api/projects/0", async (route) => {
      if (route.request().method() === "GET") {
        const detail = structuredClone(MINIMAL_PROJECT_DETAIL);
        if (itemAdded) {
          detail.data.upNext = [
            {
              id: "BL-001",
              title: "My new test task",
              type: "feature",
              priority: "P1",
              status: "pending",
              section: "ceo",
              details: "",
            },
          ];
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail),
        });
      } else {
        await route.continue();
      }
    });

    // Mock cost API (mission control uses it; backlog page itself does not)
    await page.route("**/api/projects/0/cost", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { session: 0, total: 0 } }),
      });
    });

    // Mock POST backlog — set flag so subsequent GET returns the new item
    await page.route("**/api/projects/0/backlog", async (route) => {
      if (route.request().method() === "POST") {
        itemAdded = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { success: true, id: "BL-001" } }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock backlog item detail page
    await page.route("**/api/projects/0/backlog/BL-001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(NEW_ITEM_DETAIL),
      });
    });

    // Mock stream SSE to prevent hanging connections
    await page.route("**/api/projects/0/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: {}\n\n",
      });
    });

    // 1. Navigate to backlog page
    await page.goto("/project/0/backlog", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    // 2. Click the "Add Item" button to open dialog
    const addBtn = page.getByRole("button", { name: /\+ Add Item/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 3. Verify dialog opens — the task title input should be visible
    const titleInput = page.getByRole("textbox", { name: /task title/i });
    await expect(titleInput).toBeVisible();

    // 4. Fill in the task title
    await titleInput.fill("My new test task");

    // 5. Submit the form
    const submitBtn = page.getByRole("button", { name: /add item/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 6. Wait for dialog to close and list to refresh
    await expect(titleInput).not.toBeVisible({ timeout: 5000 });

    // 7. Verify the new item title appears in the backlog list
    await expect(page.getByText("My new test task")).toBeVisible({ timeout: 5000 });

    // 8. Click the item link to navigate to detail page
    const itemLink = page.getByRole("link", { name: "My new test task" });
    await expect(itemLink).toBeVisible();
    await itemLink.click();

    // 9. Verify we land on the detail page
    await page.waitForURL(/\/project\/0\/backlog\/BL-001/, { timeout: 5000 });

    // 10. Verify the title is displayed on the detail page
    await expect(page.getByText("My new test task")).toBeVisible({ timeout: 5000 });

    // 11. Verify the priority badge is visible (P1)
    await expect(page.getByText("P1")).toBeVisible();
  });
});
