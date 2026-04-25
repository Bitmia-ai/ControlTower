/**
 * Edge middleware — Origin / Sec-Fetch-Site protection on mutating routes.
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
 */

import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isSameOrigin(req: NextRequest): boolean {
  // Sec-Fetch-Site is the modern primary signal. Browsers send it on every
  // request and it cannot be set by JS. "same-origin" or "none" (top-level
  // nav) are safe; "cross-site" / "same-site" from a different host are not.
  const sfs = req.headers.get("sec-fetch-site");
  if (sfs === "same-origin" || sfs === "none") return true;
  if (sfs === "cross-site" || sfs === "same-site") return false;

  // Fallback: Origin header check for older browsers / clients without sfs.
  const origin = req.headers.get("origin");
  if (!origin) return true; // CLI tools (curl) send no Origin — allow
  try {
    const url = new URL(origin);
    return ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
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
