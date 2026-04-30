import { test, expect } from "@playwright/test";

/**
 * T119 — Per-task time tracking.
 *
 * Verifies the new GET /api/projects/[id]/tasks/[taskId]/duration endpoint
 * (envelope shape + validation) and that the task detail page renders
 * without console errors. Robust to whatever iteration_log state any
 * registered project happens to be in: durationMs may be null for tasks
 * that pre-date the log window, and we only assert the envelope is
 * well-formed.
 */
test.describe("T119 — per-task duration", () => {
  test("duration endpoint rejects malformed taskId with 400", async ({ request }) => {
    const res = await request.get(
      "http://localhost:3200/api/projects/0/tasks/INVALID/duration"
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("taskId must match T<number>");
  });

  test("duration endpoint returns 404 for non-existent project", async ({ request }) => {
    const res = await request.get(
      "http://localhost:3200/api/projects/9999/tasks/T001/duration"
    );
    expect(res.status()).toBe(404);
  });

  test("duration endpoint returns { data: TaskDurationResult } envelope", async ({ request }) => {
    const res = await request.get(
      "http://localhost:3200/api/projects/0/tasks/T119/duration"
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json.data).toHaveProperty("taskId", "T119");
    // durationMs is either a non-negative number or null.
    expect(
      json.data.durationMs === null ||
        (typeof json.data.durationMs === "number" && json.data.durationMs >= 0)
    ).toBe(true);
    // phaseBreakdown is always an array (possibly empty)
    expect(Array.isArray(json.data.phaseBreakdown)).toBe(true);
  });

  test("task detail page renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("http://localhost:3200/project/0/tasks/T119");
    // Use "domcontentloaded" — "domcontentloaded" never fires because the task
    // detail page holds an open SSE connection (/api/projects/[id]/stream).
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const relevant = errors.filter(
      (e) => !/favicon|Hydration|hydration|_next\/static|404/i.test(e)
    );
    expect(relevant).toHaveLength(0);
  });
});
