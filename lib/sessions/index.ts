/**
 * SessionDriver — abstract surface over `lib/session-manager.ts`.
 *
 * Phase 1 wraps the local implementation. Phase 3 swaps in a
 * Radio-backed driver that issues `session.start` / `session.stop`
 * ops over WSS.
 */

import type { SessionInfo, SessionRole, SessionStatus } from "@/lib/redeye-types";

export interface SessionDriver {
  /** Synchronous read of current session state for a project. */
  status(projectPath: string): SessionStatus;

  start(projectPath: string, role: SessionRole): Promise<SessionInfo>;
  stop(projectPath: string, role: SessionRole): Promise<void>;

  /** Restore auto-restart state on daemon boot. */
  ensureAutoRestartRestored(): void;
}
