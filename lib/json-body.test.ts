// @vitest-environment node
/**
 * Tests for lib/json-body.ts — body-size DoS defense.
 *
 * The contract this file pins:
 *   - Reject non-application/json Content-Type up front (415).
 *   - Reject honest oversized Content-Length (413, cheap pre-check).
 *   - Stream-read enforces the byte cap regardless of headers, defeating
 *     the Transfer-Encoding: chunked / missing-Content-Length bypass that
 *     was the original security review N1 finding.
 *   - Invalid JSON returns 400 with a NextResponse.
 *   - Content-Type with charset suffix (`application/json; charset=utf-8`)
 *     is accepted — the regex must use `\b`, not `$`.
 */

import { describe, it, expect } from "vitest";
import { readJsonBody } from "./json-body";

/** Build a Request whose body streams `chunks` bytes-at-a-time without
 *  setting Content-Length. Used for the chunked-bypass test. */
function streamingRequest(
  chunks: Uint8Array[],
  contentType = "application/json"
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  // duplex: "half" is required by the Fetch spec when streaming a Request
  // body, but the lib.dom RequestInit typing in TS doesn't include it.
  // Cast through unknown to avoid an `any`.
  const init = {
    method: "POST",
    headers: { "content-type": contentType },
    body: stream,
    duplex: "half",
  } as unknown as RequestInit;
  return new Request("http://localhost/", init);
}

describe("readJsonBody", () => {
  it("rejects a non-application/json Content-Type with 415", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    const result = await readJsonBody(req, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(415);
      const body = await result.response.json();
      expect(body).toEqual({ error: "Content-Type must be application/json" });
    }
  });

  it("rejects an honest oversized Content-Length header with 413", async () => {
    // Construct a Request whose Content-Length advertises a body larger
    // than the cap. We don't actually need the body to be that large —
    // the cheap pre-check rejects on the header value alone.
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "5000",
      },
      body: '{"x":1}',
    });
    const result = await readJsonBody(req, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const body = await result.response.json();
      expect(body).toEqual({ error: "Request body too large" });
    }
  });

  it("rejects a streaming body that exceeds maxBytes (chunked-bypass defense)", async () => {
    // No Content-Length header → header pre-check is bypassed. The streaming
    // reader must catch this and reject mid-stream.
    const big = new Uint8Array(2048).fill(0x61); // 2 KiB of 'a'
    const req = streamingRequest([big], "application/json");
    const result = await readJsonBody(req, 256);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      const body = await result.response.json();
      expect(body).toEqual({ error: "Request body too large" });
    }
  });

  it("returns { ok: true, data } for valid JSON within the cap", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world", n: 42 }),
    });
    const result = await readJsonBody<{ hello: string; n: number }>(req, 1024);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ hello: "world", n: 42 });
    }
  });

  it("returns 400 for malformed JSON when content-type and size are valid", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });
    const result = await readJsonBody(req, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body).toEqual({ error: "Invalid JSON body" });
    }
  });

  it("accepts a Content-Type with a charset suffix (application/json; charset=utf-8)", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true }),
    });
    const result = await readJsonBody<{ ok: boolean }>(req, 1024);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: true });
    }
  });

  it("treats Content-Type matching as case-insensitive", async () => {
    // The regex uses /i — `Application/JSON` should still pass.
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "Application/JSON" },
      body: JSON.stringify({ a: 1 }),
    });
    const result = await readJsonBody(req, 1024);
    expect(result.ok).toBe(true);
  });
});
