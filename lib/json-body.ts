/**
 * lib/json-body.ts
 *
 * Read a JSON body from a NextRequest with a hard byte cap that doesn't
 * depend on Content-Length. The earlier approach gated only on the
 * Content-Length header — a client using Transfer-Encoding: chunked or
 * just omitting the header bypassed the cap entirely (security review N1).
 *
 * This implementation streams the body via `req.body.getReader()`, drops
 * as soon as the byte counter exceeds maxBytes, then parses the
 * accumulated buffer as UTF-8 JSON. Also enforces application/json
 * Content-Type — a text/plain POST is a CORS "simple request" that
 * skips preflight, so rejecting non-JSON content types narrows the
 * cross-origin attack surface even further.
 */

import { NextResponse } from "next/server";

export interface ReadJsonResult<T = unknown> {
  ok: true;
  data: T;
}
export interface ReadJsonError {
  ok: false;
  response: NextResponse;
}

export async function readJsonBody<T = unknown>(
  req: Request,
  maxBytes: number
): Promise<ReadJsonResult<T> | ReadJsonError> {
  // Reject non-JSON content types up front. Defense-in-depth against
  // CORS "simple requests" (text/plain, form-encoded) that skip preflight.
  const ct = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(ct)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      ),
    };
  }

  // Cheap pre-check: trust an honest Content-Length header for the easy
  // reject. Don't trust its absence — fall through to streaming check.
  const cl = req.headers.get("content-length");
  if (cl && Number.isFinite(parseInt(cl, 10)) && parseInt(cl, 10) > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      ),
    };
  }

  // Stream-read with a hard cap to defeat chunked / missing-header bypass.
  if (req.body) {
    const reader = req.body.getReader();
    let total = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            try { await reader.cancel(); } catch {}
            return {
              ok: false,
              response: NextResponse.json(
                { error: "Request body too large" },
                { status: 413 }
              ),
            };
          }
          chunks.push(value);
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    let parsed: T;
    try {
      parsed = JSON.parse(buf.toString("utf-8")) as T;
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      };
    }
    return { ok: true, data: parsed };
  }

  // No body — fallback to req.json() which will throw on empty.
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}
