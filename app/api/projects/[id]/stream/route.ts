// GET /api/projects/[id]/stream — SSE stream of the session transcript
//
// Priority (T013 AD-1):
//   1. .redeye/session-cto.jsonl   — Control Tower session, if fresh (< 60s)
//   2. ~/.claude/projects/{enc}/*.jsonl — most-recent CLI transcript by mtime
//   3. null                         — keepalive-only; client shows "waiting" state
//
// Both `.redeye/session-cto.jsonl` and the CLI transcripts use the Claude native
// envelope format ({type:"assistant"|"user"|"system", message:{...}}) so BOTH
// must be piped through `normalizeTranscriptLine` to produce ClaudeStreamEvent
// objects that TranscriptViewer can render (T013 reopened — bug #1).

import { NextRequest } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { createSSEStream, tailJsonl } from "@/lib/stream-utils";
import { resolveTranscriptFile } from "@/lib/transcript-file-resolver";
import { normalizeTranscriptLine } from "@/lib/transcript-normalizer";

/** How many bytes to replay from the tail when opening a mid-session stream. */
const LOOKBACK_BYTES = 64 * 1024; // 64 KB — enough for the last ~hundreds of events

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = parseInt(id, 10);
  const project = await getProjectByIndex(index);
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolvedFile = resolveTranscriptFile(project.path);

  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  };

  if (!resolvedFile) {
    // No transcript file available yet — emit keepalives and rescan every 30s.
    // If a transcript file appears, switch to tailing it.
    const encoder = new TextEncoder();
    let keepaliveTimer: ReturnType<typeof setInterval> | undefined;
    let rescanTimer: ReturnType<typeof setInterval> | undefined;
    let tailCleanup: (() => void) | undefined;
    let switched = false;

    const keepaliveStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Emit keepalives so the client knows the stream is alive.
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            clearInterval(keepaliveTimer);
          }
        }, 30_000);

        // Rescan for a transcript file every 30 seconds.
        rescanTimer = setInterval(() => {
          if (switched) return;
          const found = resolveTranscriptFile(project.path);
          if (!found) return;
          // A file appeared — stop rescanning, start tailing.
          switched = true;
          clearInterval(rescanTimer);
          tailCleanup = tailJsonl(found, (line: string) => {
            try {
              const events = normalizeTranscriptLine(line);
              for (const ev of events) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
              }
            } catch {
              // Stream might be closed.
            }
          }, { lookbackBytes: LOOKBACK_BYTES });
        }, 30_000);
      },
      cancel() {
        if (keepaliveTimer !== undefined) clearInterval(keepaliveTimer);
        if (rescanTimer !== undefined) clearInterval(rescanTimer);
        tailCleanup?.();
      },
    });

    return new Response(keepaliveStream as unknown as BodyInit, {
      headers: sseHeaders,
    });
  }

  // Both `.redeye/session-cto.jsonl` and the CLI transcripts are in Claude's
  // native envelope format, so both need to be normalized into ClaudeStreamEvent
  // objects before being emitted. Any line the normalizer can't handle
  // (e.g. `type:"system"` hook events) returns an empty array and is skipped.
  const sseOptions: Parameters<typeof createSSEStream>[1] = {
    lookbackBytes: LOOKBACK_BYTES,
    // Periodically re-resolve the transcript file so the stream switches
    // to a new session file when one appears (AD-4 rescan).
    fileResolver: () => resolveTranscriptFile(project.path),
    lineTransformer: (line: string): string[] | null => {
      const events = normalizeTranscriptLine(line);
      if (events.length === 0) return null;
      return events.map((ev) => JSON.stringify(ev));
    },
  };

  const stream = createSSEStream(resolvedFile, sseOptions) as unknown as BodyInit;

  return new Response(stream, { headers: sseHeaders });
}
