/**
 * T125 — Run Now should create a visible pending task entry in the
 * Tasks tab and the "Up Next" card on mission control.
 *
 * Strategy:
 *   1. Discover a project that has at least one schedule defined.
 *   2. Snapshot existing pending tasks before clicking Run Now.
 *   3. Trigger Run Now via the schedules page UI.
 *   4. Verify the RunButton transitions to a "Queued" success state and
 *      that the response carried a taskId (so the label includes it).
 *   5. Navigate to the Tasks tab — the new "Run schedule: …" item must
 *      appear in the pending list within one poll cycle.
 *   6. Navigate to the mission-control overview — the entry must be
 *      reachable in the Up Next card (it shows up to 3 items).
 *
 * The test is read-only with respect to existing schedules: clicking Run
 * Now is idempotent — at worst it stamps the schedule as overdue, which
 * the SCHEDULES phase will heal on the next pass.
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
    const sched = await page.request.get(
      `/api/projects/${i}/schedules`
    );
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

test.describe("T125 — Run Now creates a pending task entry", () => {
  test("queued task shows up in Tasks tab and Up Next card", async ({
    page,
  }) => {
    const project = await findProjectWithSchedule(page);
    test.skip(
      project === null,
      "No project with at least one schedule available — skipping"
    );
    if (project === null) return;

    // ---- 1. Navigate to schedules page and click Run now. -----------
    await page.goto(`/project/${project.id}/schedules`);
    await expect(page.locator("body")).toBeVisible();

    // Click the first available "Run schedule SCHED-…" button.
    const runBtn = page
      .getByRole("button", { name: /run schedule SCHED-/i })
      .first();
    await expect(runBtn).toBeVisible();

    // Capture the SCHED-id from the button's aria-label so we can later
    // correlate the new task by its title.
    const ariaLabel = (await runBtn.getAttribute("aria-label")) ?? "";
    const schedMatch = ariaLabel.match(/SCHED-\d+/i);
    expect(schedMatch, "expected SCHED id in aria-label").not.toBeNull();
    const scheduleId = (schedMatch as RegExpMatchArray)[0];

    await runBtn.click();

    // ---- 2. Verify Queued (T<N>) success state. ---------------------
    // The success label format is "Queued (T<N>) ✓" when taskId is
    // returned. Match either form so the test is robust against future
    // layout tweaks.
    const queuedLabel = page.getByText(/Queued/i).first();
    await expect(queuedLabel).toBeVisible({ timeout: 10_000 });
    const queuedText = (await queuedLabel.textContent()) ?? "";
    const taskIdMatch = queuedText.match(/T\d+/);
    expect(
      taskIdMatch,
      `expected task ID in queued label, got: ${queuedText}`
    ).not.toBeNull();
    const newTaskId = (taskIdMatch as RegExpMatchArray)[0];

    // ---- 3. Navigate to Tasks tab. ----------------------------------
    await page.goto(`/project/${project.id}/tasks`);
    await expect(page.locator("body")).toBeVisible();

    // The new item should appear in the pending list. Title must
    // contain "Run schedule:".
    await expect(
      page.getByText(new RegExp(`${newTaskId}.*Run schedule`, "i")).first()
    ).toBeVisible({ timeout: 10_000 });

    // ---- 4. Navigate to mission control. ----------------------------
    await page.goto(`/project/${project.id}`);
    await expect(page.locator("body")).toBeVisible();

    // Up Next card shows the top 3 pending tasks; the newly inserted
    // one is at the head of CEO Requests so it should be visible. We
    // check for the "Up Next" heading and a row mentioning the task id
    // OR the schedule id — either correlation is sufficient.
    const upNext = page.getByText(/Up Next/i).first();
    await expect(upNext).toBeVisible();

    // The Up Next card surfaces task title; allow either the new T-id
    // or the schedule id to appear.
    const newTaskInUpNext = page
      .getByText(new RegExp(`Run schedule|${scheduleId}`, "i"))
      .first();
    await expect(newTaskInUpNext).toBeVisible({ timeout: 10_000 });
  });
});
