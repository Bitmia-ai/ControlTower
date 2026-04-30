/**
 * TranscriptSource — locates a session's JSONL transcript file.
 *
 * Phase 1 surface is intentionally thin (just resolve + encode); the
 * SSE streaming path stays in `app/api/projects/[id]/stream/route.ts`
 * where it lives today. Phase 3 will replace the local JSONL tail
 * with a subscription on a Radio WS connection.
 */

export interface TranscriptSource {
  /**
   * Path to the active session's JSONL file under
   * `~/.claude/projects/<encoded>/`, or null if not found.
   */
  resolve(projectPath: string): string | null;

  /** The `~/.claude/projects/`-style encoded form of a project path. */
  encodeProjectPath(projectPath: string): string;
}
