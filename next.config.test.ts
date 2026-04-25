import { describe, it, expect } from "vitest";
import nextConfig from "./next.config";

describe("next.config headers()", () => {
  it("exports a headers async function", () => {
    expect(typeof nextConfig.headers).toBe("function");
  });

  it("includes a rule for /_next/static/* with immutable cache", async () => {
    const rules = await nextConfig.headers!();
    const staticRule = rules.find((r) => r.source === "/_next/static/:path*");
    expect(staticRule).toBeTruthy();
    const cacheHeader = staticRule!.headers.find(
      (h) => h.key === "Cache-Control"
    );
    expect(cacheHeader?.value).toContain("immutable");
    expect(cacheHeader?.value).toContain("max-age=31536000");
  });

  it("includes a rule for /api/* with no-store", async () => {
    const rules = await nextConfig.headers!();
    const apiRule = rules.find((r) => r.source === "/api/:path*");
    expect(apiRule).toBeTruthy();
    const cacheHeader = apiRule!.headers.find(
      (h) => h.key === "Cache-Control"
    );
    expect(cacheHeader?.value).toContain("no-store");
  });
});
