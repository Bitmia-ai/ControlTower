/**
 * proxy.ts — Origin / Sec-Fetch-Site protection on mutating routes.
 *
 * Control Tower binds to 127.0.0.1 with no auth. The trust assumption is
 * "anything on localhost is the legitimate user." That's wrong as soon as
 * a browser is in the loop: any website you visit can `fetch()` against
 * 127.0.0.1:3200, and a "simple" POST (no custom headers) is not
 * preflighted by CORS — meaning the request hits the API and the malicious
 * page's JS just doesn't see the response. The side effect (spawning a
 * Claude session, writing to .redeye/*.md) still happens.
 *
 * Defense: validate Origin / Sec-Fetch-Site on every mutating method.
 * Same-origin POSTs from the dashboard pass; cross-origin POSTs from
 * drive-by pages fail with 403. GETs are still allowed — they're SOP for
 * the no-credentials case and don't mutate.
 *
 * Migrated from middleware.ts (Next.js 16 renamed the convention to proxy).
 */

import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isSameOrigin(req: NextRequest): boolean {
  // Sec-Fetch-Site is the modern primary signal. Browsers send it on every
  // request and it cannot be set by JS. "same-origin" or "none" (top-level
  // nav) are safe; "cross-site" / "same-site" from a different host are not.
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs === "same-origin" || sfs === "none") return true;
  if (sfs === "cross-site" || sfs === "same-site") return false;

  // Fail closed when both signals are absent. Older browsers and embedded
  // WebViews can omit Sec-Fetch-Site on cross-origin form POSTs (CORS
  // "simple requests" aren't preflighted), so trust-on-absence reopens the
  // drive-by RCE this middleware exists to block. CLI tools (curl) need to
  // pass an Origin header — trivially `-H 'Origin: http://127.0.0.1:3200'`.
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

// Next.js 16 requires the function to be exported as `proxy` (not `middleware`).
export function proxy(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) {
    return NextResponse.next();
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin request blocked" },
      { status: 403 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
