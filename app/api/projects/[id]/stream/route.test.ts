import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
  parseProjectIndex: vi.fn((id) => /^(0|[1-9]\d*)$/.test(id) ? parseInt(id, 10) : null),
}));

vi.mock("@/lib/transcript-file-resolver", () => ({
  resolveTranscriptFile: vi.fn(),
}));

vi.mock("@/lib/stream-utils", () => ({
  createSSEStream: vi.fn(() => new ReadableStream()),
  tailJsonl: vi.fn(() => () => {}),
}));

vi.mock("@/lib/transcript-normalizer", () => ({
  normalizeTranscriptLine: vi.fn(() => []),
}));

import { GET } from "./route";
import { getProjectByIndex } from "@/lib/projects";
import { resolveTranscriptFile } from "@/lib/transcript-file-resolver";
import { createSSEStream } from "@/lib/stream-utils";
import { normalizeTranscriptLine } from "@/lib/transcript-normalizer";

const mockGetProject = getProjectByIndex as ReturnType<typeof vi.fn>;
const mockResolveTranscript = resolveTranscriptFile as ReturnType<typeof vi.fn>;
const mockCreateSSEStream = createSSEStream as unknown as ReturnType<typeof vi.fn>;
const mockNormalize = normalizeTranscriptLine as ReturnType<typeof vi.fn>;

const PROJECT = { name: "haze", path: "/tmp/haze" };
const TRANSCRIPT_PATH = "/tmp/.claude/projects/-tmp-haze/abc123.jsonl";

function makeGet(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest(`http://localhost:3200/api/projects/${id}/stream`);
  return [req, { params: Promise.resolve({ id }) }];
}

describe("GET /api/projects/[id]/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: createSSEStream returns a fresh empty ReadableStream each call.
    mockCreateSSEStream.mockImplementation(() => new ReadableStream());
  });

  it("returns 404 JSON when project is missing", async () => {
    mockGetProject.mockResolvedValue(null);
    const [req, ctx] = makeGet("99");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const json = await res.json();
    expect(json.error).toBe("Project not found");
    expect(mockCreateSSEStream).not.toHaveBeenCalled();
  });

  describe("no transcript file resolved (keepalive branch)", () => {
    beforeEach(() => {
      mockGetProject.mockResolvedValue(PROJECT);
      mockResolveTranscript.mockReturnValue(null);
    });

    it("returns SSE Content-Type header", async () => {
      const [req, ctx] = makeGet("0");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    });

    it("returns SSE Cache-Control header", async () => {
      const [req, ctx] = makeGet("0");
      const res = await GET(req, ctx);
      expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    });

    it("returns SSE Connection header", async () => {
      const [req, ctx] = makeGet("0");
      const res = await GET(req, ctx);
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });

    it("body is a ReadableStream and createSSEStream is not called", async () => {
      const [req, ctx] = makeGet("0");
      const res = await GET(req, ctx);
      expect(res.body).toBeInstanceOf(ReadableStream);
      // The keepalive branch builds its own stream inline; createSSEStream
      // is reserved for the resolved-file branch.
      expect(mockCreateSSEStream).not.toHaveBeenCalled();
      // Cancel so timers shut down cleanly.
      await res.body?.cancel();
    });
  });

  describe("transcript file resolved (createSSEStream branch)", () => {
    beforeEach(() => {
      mockGetProject.mockResolvedValue(PROJECT);
      mockResolveTranscript.mockReturnValue(TRANSCRIPT_PATH);
    });

    it("returns all three SSE headers", async () => {
      const [req, ctx] = makeGet("0");
      const res = await GET(req, ctx);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
      expect(res.headers.get("Connection")).toBe("keep-alive");
    });

    it("calls createSSEStream with the resolved transcript path", async () => {
      const [req, ctx] = makeGet("0");
      await GET(req, ctx);
      expect(mockCreateSSEStream).toHaveBeenCalledTimes(1);
      const [filePath] = mockCreateSSEStream.mock.calls[0] as [string, unknown];
      expect(filePath).toBe(TRANSCRIPT_PATH);
    });

    it("passes fileResolver and lineTransformer options", async () => {
      const [req, ctx] = makeGet("0");
      await GET(req, ctx);
      const [, options] = mockCreateSSEStream.mock.calls[0] as [
        string,
        { fileResolver?: () => string | null; lineTransformer?: (l: string) => unknown }
      ];
      expect(typeof options.fileResolver).toBe("function");
      expect(typeof options.lineTransformer).toBe("function");
    });

    it("lineTransformer returns null when normalizer yields no events", async () => {
      const [req, ctx] = makeGet("0");
      await GET(req, ctx);
      const [, options] = mockCreateSSEStream.mock.calls[0] as [
        string,
        { lineTransformer: (l: string) => string[] | null }
      ];

      mockNormalize.mockReturnValueOnce([]);
      const out = options.lineTransformer('{"type":"system"}');
      expect(out).toBeNull();
    });

    it("lineTransformer returns array of JSON-stringified events when normalizer yields events", async () => {
      const [req, ctx] = makeGet("0");
      await GET(req, ctx);
      const [, options] = mockCreateSSEStream.mock.calls[0] as [
        string,
        { lineTransformer: (l: string) => string[] | null }
      ];

      const fakeEvent = { type: "assistant", text: "hello" };
      mockNormalize.mockReturnValueOnce([fakeEvent]);
      const out = options.lineTransformer('{"type":"assistant"}');
      expect(out).not.toBeNull();
      expect(Array.isArray(out)).toBe(true);
      expect(out).toHaveLength(1);
      expect(JSON.parse(out![0])).toEqual(fakeEvent);
    });

    it("fileResolver delegates to resolveTranscriptFile with project.path", async () => {
      const [req, ctx] = makeGet("0");
      await GET(req, ctx);
      const [, options] = mockCreateSSEStream.mock.calls[0] as [
        string,
        { fileResolver: () => string | null }
      ];

      mockResolveTranscript.mockClear();
      mockResolveTranscript.mockReturnValue("/tmp/.claude/projects/-tmp-haze/new.jsonl");
      const result = options.fileResolver();
      expect(mockResolveTranscript).toHaveBeenCalledWith(PROJECT.path);
      expect(result).toBe("/tmp/.claude/projects/-tmp-haze/new.jsonl");
    });
  });
});

describe("parseProjectIndex bad-id guard", () => {
  it("returns 400 with id-must-be-non-negative-integer error for non-numeric id", async () => {
    const [req, ctx] = makeGet("abc");
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id must be a non-negative integer");
  });
});
