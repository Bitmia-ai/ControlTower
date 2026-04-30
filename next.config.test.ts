// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nextConfig from "./next.config";

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

async function getRules(): Promise<HeaderRule[]> {
  const rules = await nextConfig.headers!();
  return rules as HeaderRule[];
}

function findCatchAll(rules: HeaderRule[]): HeaderRule | undefined {
  return rules.find((r) => r.source === "/(.*)");
}

function getHeader(rule: HeaderRule, key: string): string | undefined {
  return rule.headers.find((h) => h.key === key)?.value;
}

describe("next.config headers()", () => {
  it("exports a headers async function", () => {
    expect(typeof nextConfig.headers).toBe("function");
  });

  it("includes a rule for /_next/static/* with immutable cache", async () => {
    const rules = await getRules();
    const staticRule = rules.find((r) => r.source === "/_next/static/:path*");
    expect(staticRule).toBeTruthy();
    const cacheHeader = staticRule!.headers.find(
      (h) => h.key === "Cache-Control"
    );
    expect(cacheHeader?.value).toContain("immutable");
    expect(cacheHeader?.value).toContain("max-age=31536000");
  });

  it("includes a rule for /api/* with no-store", async () => {
    const rules = await getRules();
    const apiRule = rules.find((r) => r.source === "/api/:path*");
    expect(apiRule).toBeTruthy();
    const cacheHeader = apiRule!.headers.find(
      (h) => h.key === "Cache-Control"
    );
    expect(cacheHeader?.value).toContain("no-store");
  });
});

describe("next.config turbopack config (T077)", () => {
  it("exports turbopack config with a root property", () => {
    expect(nextConfig.turbopack).toBeDefined();
    expect(typeof (nextConfig.turbopack as { root: string }).root).toBe("string");
  });

  it("turbopack root is an absolute path pointing to the project directory", () => {
    const root = (nextConfig.turbopack as { root: string }).root;
    expect(root).toMatch(/ControlTower/);
    // Should be an absolute path (starts with /)
    expect(root.startsWith("/")).toBe(true);
  });
});

describe("next.config security headers (T155)", () => {
  beforeEach(() => {
    // Default to production for these checks; specific tests override via stubEnv.
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes a catch-all rule with source '/(.*)' for security headers", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules);
    expect(catchAll).toBeTruthy();
    expect(catchAll!.headers.length).toBeGreaterThanOrEqual(5);
  });

  it("includes all five required security header keys on the catch-all rule", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    const keys = catchAll.headers.map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
  });

  it("X-Frame-Options is DENY", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    expect(getHeader(catchAll, "X-Frame-Options")).toBe("DENY");
  });

  it("X-Content-Type-Options is nosniff", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    expect(getHeader(catchAll, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("Referrer-Policy is same-origin", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    expect(getHeader(catchAll, "Referrer-Policy")).toBe("same-origin");
  });

  it("Permissions-Policy disables camera, microphone, and geolocation", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    const policy = getHeader(catchAll, "Permissions-Policy");
    expect(policy).toBeTruthy();
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("CSP includes the required directives", async () => {
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    const csp = getHeader(catchAll, "Content-Security-Policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("CSP script-src in production allows 'unsafe-inline' but NOT 'unsafe-eval'", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    const csp = getHeader(catchAll, "Content-Security-Policy")!;
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();
    const scriptSrc = scriptSrcMatch![1];
    expect(scriptSrc).toContain("'self'");
    // Inline scripts emitted by Next.js App Router (theme/hydration) require
    // 'unsafe-inline' until a nonce-based CSP is introduced.
    expect(scriptSrc).toContain("'unsafe-inline'");
    // Eval-based source maps are dev-only.
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("CSP script-src in development contains 'unsafe-eval' for webpack HMR", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const rules = await getRules();
    const catchAll = findCatchAll(rules)!;
    const csp = getHeader(catchAll, "Content-Security-Policy")!;
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();
    const scriptSrc = scriptSrcMatch![1];
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it("preserves existing cache-control entries alongside catch-all (regression guard)", async () => {
    const rules = await getRules();
    const sources = rules.map((r) => r.source);
    expect(sources).toContain("/(.*)");
    expect(sources).toContain("/_next/static/:path*");
    expect(sources).toContain("/api/:path*");
  });
});
