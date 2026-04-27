// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isSameOrigin, proxy, config } from "./proxy";

function makeRequest(
  method: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://127.0.0.1:3200/api/projects/1/start", {
    method,
    headers,
  });
}

describe("proxy.ts — CSRF / origin protection", () => {
  describe("config export", () => {
    it("exports config with matcher for /api/* routes", () => {
      expect(config.matcher).toContain("/api/:path*");
    });
  });

  describe("isSameOrigin — Sec-Fetch-Site header (primary signal)", () => {
    it("passes when Sec-Fetch-Site is same-origin", () => {
      const req = makeRequest("POST", { "sec-fetch-site": "same-origin" });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("passes when Sec-Fetch-Site is none (top-level navigation)", () => {
      const req = makeRequest("POST", { "sec-fetch-site": "none" });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("blocks when Sec-Fetch-Site is cross-site", () => {
      const req = makeRequest("POST", { "sec-fetch-site": "cross-site" });
      expect(isSameOrigin(req)).toBe(false);
    });

    it("blocks when Sec-Fetch-Site is same-site (different subdomain)", () => {
      const req = makeRequest("POST", { "sec-fetch-site": "same-site" });
      expect(isSameOrigin(req)).toBe(false);
    });
  });

  describe("isSameOrigin — Origin header fallback (no Sec-Fetch-Site)", () => {
    it("passes for Origin: http://127.0.0.1:3200", () => {
      const req = makeRequest("POST", { origin: "http://127.0.0.1:3200" });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("passes for Origin: http://localhost:3200", () => {
      const req = makeRequest("POST", { origin: "http://localhost:3200" });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("passes for Origin: http://[::1]:3200 (IPv6 loopback)", () => {
      const req = makeRequest("POST", { origin: "http://[::1]:3200" });
      expect(isSameOrigin(req)).toBe(true);
    });

    it("blocks for a foreign origin", () => {
      const req = makeRequest("POST", { origin: "http://evil.com" });
      expect(isSameOrigin(req)).toBe(false);
    });

    it("blocks when no Sec-Fetch-Site and no Origin header (fail-closed)", () => {
      const req = makeRequest("POST");
      expect(isSameOrigin(req)).toBe(false);
    });

    it("blocks when Origin header is a malformed URL", () => {
      const req = makeRequest("POST", { origin: "not-a-url" });
      expect(isSameOrigin(req)).toBe(false);
    });
  });

  describe("proxy() — safe methods bypass CSRF check", () => {
    it("allows GET regardless of origin", async () => {
      const req = makeRequest("GET", { "sec-fetch-site": "cross-site" });
      const res = proxy(req);
      // NextResponse.next() returns a response with no body and status 200
      expect(res.status).toBe(200);
    });

    it("allows HEAD regardless of origin", async () => {
      const req = makeRequest("HEAD", { "sec-fetch-site": "cross-site" });
      const res = proxy(req);
      expect(res.status).toBe(200);
    });

    it("allows OPTIONS regardless of origin", async () => {
      const req = makeRequest("OPTIONS", { "sec-fetch-site": "cross-site" });
      const res = proxy(req);
      expect(res.status).toBe(200);
    });
  });

  describe("proxy() — mutating methods enforced", () => {
    it("allows POST from same-origin (dashboard UI)", async () => {
      const req = makeRequest("POST", { "sec-fetch-site": "same-origin" });
      const res = proxy(req);
      expect(res.status).toBe(200);
    });

    it("blocks POST from cross-site origin", async () => {
      const req = makeRequest("POST", { "sec-fetch-site": "cross-site" });
      const res = proxy(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Cross-origin request blocked");
    });

    it("blocks DELETE from cross-site origin", async () => {
      const req = makeRequest("DELETE", { "sec-fetch-site": "cross-site" });
      const res = proxy(req);
      expect(res.status).toBe(403);
    });

    it("blocks POST with no headers at all (fail-closed against legacy browsers)", async () => {
      const req = makeRequest("POST");
      const res = proxy(req);
      expect(res.status).toBe(403);
    });

    it("allows POST with allowed Origin header and no Sec-Fetch-Site", async () => {
      const req = makeRequest("POST", { origin: "http://127.0.0.1:3200" });
      const res = proxy(req);
      expect(res.status).toBe(200);
    });
  });
});
