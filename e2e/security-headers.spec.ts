/**
 * E2E tests for T155 — HTTP security response headers.
 *
 * Verifies the dashboard ships the expected security headers on every
 * route (HTML, API, static assets) and that the prod build does not
 * produce any Content-Security-Policy violations in the browser console.
 */

import { test, expect, type Page } from "@playwright/test";

const REQUIRED_HEADERS: Record<string, string | RegExp> = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "permissions-policy": /camera=\(\).*microphone=\(\).*geolocation=\(\)/,
  "content-security-policy":
    /default-src 'self'.*frame-ancestors 'none'.*form-action 'self'/,
};

async function assertSecurityHeaders(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response, `Expected a response for ${url}`).not.toBeNull();
  const headers = response!.headers();
  for (const [key, expected] of Object.entries(REQUIRED_HEADERS)) {
    const actual = headers[key];
    if (expected instanceof RegExp) {
      expect(actual, `Header ${key} on ${url}`).toMatch(expected);
    } else {
      expect(actual, `Header ${key} on ${url}`).toBe(expected);
    }
  }
}

test.describe("T155 security headers", () => {
  test("home page ships all five security headers", async ({ page }) => {
    await assertSecurityHeaders(page, "/");
  });

  test("static asset responses include the security headers (catch-all merge)", async ({
    page,
  }) => {
    // Visit the home page so Next.js emits the manifest & favicon links;
    // then directly request a static asset to inspect its response.
    await page.goto("/");
    const response = await page.request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
  });

  test("CSP script-src in prod allows self+unsafe-inline but NOT unsafe-eval", async ({
    page,
  }) => {
    const response = await page.goto("/");
    const csp = response!.headers()["content-security-policy"]!;
    const match = csp.match(/script-src ([^;]+)/);
    expect(match).not.toBeNull();
    const scriptSrc = match![1];
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  test("home page renders without CSP console violations", async ({ page }) => {
    const cspErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /Content Security Policy/i.test(msg.text())
      ) {
        cspErrors.push(msg.text());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(cspErrors).toEqual([]);
  });
});
