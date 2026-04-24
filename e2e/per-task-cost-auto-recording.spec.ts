import { test, expect } from "@playwright/test";

/**
 * BL-046 — Per-task cost auto-recorded as end-minus-start delta.
 *
 * The mission control page polls every 5s. On each poll we compare the
 * active backlog_item id. When it changes we:
 *   1. POST /api/projects/[id]/cost-start   (record baseline for new id)
 *   2. POST /api/projects/[id]/cost-snapshot (record delta for outgoing id)
 *
 * These tests exercise the page and verify the endpoints are reachable.
 * They are robust to any session state — haze may or may not have an
 * active task. We only verify that:
 *   - The mission control page renders without JS errors.
 *   - cost-start POST returns 200 for a valid blId (idempotent on rerun).
 *   - cost-snapshot POST returns 200 for a valid blId.
 */
test.describe("BL-046 — auto cost recording", () => {
  test("mission control page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("http://localhost:3200/project/0");
    await page.waitForLoadState("networkidle");

    // Filter out well-known noise not related to this feature.
    const relevant = errors.filter(
      (e) => !/favicon|Hydration|hydration|_next\/static/i.test(e)
    );
    expect(relevant).toHaveLength(0);
  });

  test("cost-start endpoint responds 200 and is idempotent", async ({ request }) => {
    const blId = "BL-046-e2e-test";

    const first = await request.post("http://localhost:3200/api/projects/0/cost-start", {
      data: { blId },
    });
    expect(first.status()).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.data.blId).toBe(blId);

    // Second call with same blId should be skipped by the idempotency guard.
    const second = await request.post("http://localhost:3200/api/projects/0/cost-start", {
      data: { blId },
    });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.data.blId).toBe(blId);
    expect(secondJson.data.skipped).toBe(true);
  });

  test("cost-start rejects missing blId", async ({ request }) => {
    const res = await request.post("http://localhost:3200/api/projects/0/cost-start", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("cost-snapshot endpoint responds for a valid blId", async ({ request }) => {
    // After the cost-start test above, BL-046-e2e-test has a baseline recorded.
    // A snapshot will compute the delta (or clamp to 0 if session cost < baseline).
    const res = await request.post("http://localhost:3200/api/projects/0/cost-snapshot", {
      data: { blId: "BL-046-e2e-test" },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.data.blId).toBe("BL-046-e2e-test");
    // cost_usd must be a finite non-negative number
    expect(typeof json.data.cost_usd).toBe("number");
    expect(json.data.cost_usd).toBeGreaterThanOrEqual(0);
  });
});
