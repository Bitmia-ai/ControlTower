/**
 * RadioTranscriptSource — Phase 3 v0 stub.
 *
 * Live transcript streaming is a subscribe.transcript op (PROTOCOL.md
 * §6.5). The shape doesn't fit a synchronous `resolve(path) → string`
 * — this interface exists to locate a JSONL file path on the local
 * box. With Radio in the loop, the equivalent is a streaming
 * subscription, not a path. Phase 3.1 reshapes the SSE route to
 * use the subscription channel instead.
 */

import type { TranscriptSource } from "@/lib/transcript";
import type { RadioConnection } from "@/lib/radio/client";

export class RadioTranscriptSource implements TranscriptSource {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly conn: RadioConnection) {}

  resolve(_projectPath: string): string | null {
    // Returning null means "no transcript file" → CT's stream route
    // surfaces an empty stream rather than crashing. Real impl
    // pipes subscribe.transcript chunks through SSE.
    return null;
  }

  encodeProjectPath(_projectPath: string): string {
    // Without a local Claude transcript file, the encoded form is
    // not meaningful in Radio mode. Empty string is the safest stub.
    return "";
  }
}
