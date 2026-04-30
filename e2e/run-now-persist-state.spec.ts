/**
 * T126 — Clicking Run Now and refreshing should preserve the "Queued (T<N>) ✓"
 * indicator until the task is no longer pending.
 *
 * Strategy:
 *   1. Discover a project that has at least one schedule defined.
 *   2. Navigate to the schedules page, click Run Now on the first schedule.
 *   3. Assert the "Queued (T<N>) ✓" label appears.
 *   4. Reload the page.
 *   5. The same Queued label must still be visible after reload, since the
 *      backing task is still pending and localStorage carries the state.
 *
 * The test is best-effort idempotent: clicking Run Now creates a pending task,
 * which the SCHEDULES phase will eventually consume.
 */

import { test, expect, type Page } from "@playwright/test";

interface ProjectListEntry {
  name: string;
  path: string;
}

async function findProjectWithSchedule(
  page: Page
): Promise<{ id: number; name: string } | null> {
  const res = await page.request.get("/api/projects");
  if (!res.ok()) return null;
  const json = (await res.json()) as { data?: ProjectListEntry[] };
  const projects = json.data ?? [];
  for (let i = 0; i < projects.length; i++) {
    const sched = await page.request.get(`/api/projects/${i}/schedules`);
    if (!sched.ok()) continue;
    const body = (await sched.json()) as {
      data?: { schedules?: Array<{ id: string }> };
    };
    if ((body.data?.schedules ?? []).length > 0) {
      return { id: i, name: projects[i].name };
    }
  }
  return null;
}

test.describe("T126 — Run Now queued indicator persists across refresh", () => {
  test("Queued (T<N>) label survives a page reload while task is still pending", async ({
    page,
  }) => {
    const project = await findProjectWithSchedule(page);
    test.skip(
      project === null,
      "No project with at least one schedule available — skipping"
    );
    if (project === null) return;

    // ---- 1. Navigate to schedules page and click Run Now. ------------
    await page.goto(`/project/${project.id}/schedules`);
    await expect(page.locator("body")).toBeVisible();

    const runBtn = page
      .getByRole("button", { name: /run schedule SCHED-/i })
      .first();
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // ---- 2. Assert Queued (T<N>) success label visible. --------------
    const queuedLabel = page.getByText(/Queued \(T\d+\)/i).first();
    await expect(queuedLabel).toBeVisible({ timeout: 10_000 });
    const initialText = (await queuedLabel.textContent()) ?? "";
    const taskIdMatch = initialText.match(/T\d+/);
    expect(
      taskIdMatch,
      `expected task ID in initial queued label, got: ${initialText}`
    ).not.toBeNull();
    const taskId = (taskIdMatch as RegExpMatchArray)[0];

    // ---- 3. Reload the page. -----------------------------------------
    // Reload immediately — well within the 5-minute fallback and likely
    // before the CTO has begun the task. The localStorage entry should
    // restore the indicator.
    await page.reload();
    await expect(page.locator("body")).toBeVisible();

    // ---- 4. Assert Queued (T<N>) is still visible after reload. ------
    // Use the specific task id we captured above to be exact.
    const restored = page
      .getByText(new RegExp(`Queued \\(${taskId}\\)`, "i"))
      .first();
    await expect(restored).toBeVisible({ timeout: 10_000 });
  });
});
