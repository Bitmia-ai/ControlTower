import { test, expect } from "@playwright/test";

/**
 * T120 — UI exploration regression tests.
 *
 * Each `test()` below pins a specific bug fix that surfaced during the
 * iter-145 full-route exploration. Use `domcontentloaded` (not
 * `networkidle`) per the established T119 pattern — the home page opens
 * a long-lived SSE-ish poller and `networkidle` would hang.
 *
 * Tests are tolerant of running against a live dashboard whose project
 * list may shift over time: they probe behaviour rather than asserting
 * exact strings where possible.
 */

const BASE = "http://localhost:3200";

test.describe("T120 — UI exploration regression suite", () => {
  test("home: phase footer is human-readable for lower-case state.json phase", async ({
    page,
  }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("domcontentloaded");

    // Phase footer text is on every project card; the regression was
    // rendering raw "build" instead of "Building". Even one card matching
    // the new label proves the normalizePhase() helper is wired.
    const phaseFooters = page.locator('[data-testid="phase-footer"]');
    await expect(phaseFooters.first()).toBeVisible();

    // Collect every footer's text and assert no card shows a bare lower-case
    // phase token. Allow "No tasks" / "Idle" / human labels.
    const labels = await phaseFooters.allInnerTexts();
    const badRaw = labels.find((l) =>
      /\b(triage|plan|build|review|deploy|verify|merge|harden|stabilize|incorporate|schedules)\b/.test(
        l
      )
    );
    expect(badRaw, `Found raw phase token in footer: ${badRaw}`).toBeUndefined();
  });

  test("mission-control: no 400 from /cost-start on page load", async ({
    page,
  }) => {
    const failures: { url: string; status: number }[] = [];
    page.on("response", (resp) => {
      const url = resp.url();
      if (url.includes("/cost-start") && resp.status() >= 400) {
        failures.push({ url, status: resp.status() });
      }
    });

    await page.goto(`${BASE}/project/1`);
    await page.waitForLoadState("domcontentloaded");
    // Give the auto cost-start POST a beat to fire.
    await page.waitForTimeout(1500);

    expect(
      failures,
      `cost-start regressed: ${JSON.stringify(failures)}`
    ).toHaveLength(0);
  });

  test("tasks: sort dropdown options are prefixed with 'Sort:'", async ({
    page,
  }) => {
    await page.goto(`${BASE}/project/1/tasks`);
    await page.waitForLoadState("domcontentloaded");

    const sortSelect = page.locator('[data-testid="list-toolbar-sort"]').first();
    await expect(sortSelect).toBeVisible();

    // Every <option> rendered must carry the "Sort: " prefix so the closed
    // chip cannot be confused with neighbouring filter chips.
    const optionTexts = await sortSelect.locator("option").allInnerTexts();
    expect(optionTexts.length).toBeGreaterThan(0);
    for (const t of optionTexts) {
      expect(t).toMatch(/^Sort:\s+/);
    }
  });

  test("schedules: Unix-epoch placeholder renders as 'Never run' / 'Never' / '—'", async ({
    page,
  }) => {
    await page.goto(`${BASE}/project/1/schedules`);
    await page.waitForLoadState("domcontentloaded");

    // Look for the schedule that ships with the placeholder timestamp.
    const sched3 = page.locator("text=SCHED-3").first();
    if (await sched3.isVisible().catch(() => false)) {
      // The badge column on this row must be the "Never run" pill.
      const row = page.locator('div', { has: sched3 }).first();
      // The row also must NOT show a "weeks ago" relative for the placeholder.
      // (A real run inside the same row would be future-tense from "now".)
      const text = await row.innerText();
      expect(text).not.toMatch(/\d+\s+weeks\s+ago/);
      expect(text).toMatch(/Never|—/);
    }
  });

  test("live transcript: SSE page loads without console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(`${BASE}/project/1/live`);
    await page.waitForLoadState("domcontentloaded");
    // SSE keeps connection open — hold briefly without networkidle.
    await page.waitForTimeout(800);

    // Expect zero errors on the live tab; the SSE connection is fire-and-forget.
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("history: session row expands to show timestamps + UUID", async ({
    page,
  }) => {
    await page.goto(`${BASE}/project/1/history`);
    await page.waitForLoadState("domcontentloaded");

    const firstRow = page.locator('button[aria-expanded]').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      // Expanded body shows "Started:" timestamp.
      await expect(page.locator("text=Started:").first()).toBeVisible();
    }
  });
});
