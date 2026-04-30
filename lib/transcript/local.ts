/**
 * LocalTranscriptSource — wraps `lib/transcript-file-resolver.ts`.
 */

import * as resolver from "@/lib/transcript-file-resolver";

import type { TranscriptSource } from "./index";

export class LocalTranscriptSource implements TranscriptSource {
  resolve(projectPath: string): string | null {
    return resolver.resolveTranscriptFile(projectPath);
  }
  encodeProjectPath(projectPath: string): string {
    return resolver.encodeProjectPath(projectPath);
  }
}
