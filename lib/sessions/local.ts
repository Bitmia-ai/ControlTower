/**
 * LocalSessionDriver — pass-through wrapper around the existing
 * `lib/session-manager.ts`.
 */

import type { SessionInfo, SessionRole, SessionStatus } from "@/lib/redeye-types";
import * as sm from "@/lib/session-manager";

import type { SessionDriver } from "./index";

export class LocalSessionDriver implements SessionDriver {
  status(projectPath: string): SessionStatus {
    return sm.getSessionStatus(projectPath);
  }
  start(projectPath: string, role: SessionRole): Promise<SessionInfo> {
    return sm.startSession(projectPath, role);
  }
  stop(projectPath: string, role: SessionRole): Promise<void> {
    return sm.stopSession(projectPath, role);
  }
  ensureAutoRestartRestored(): void {
    sm.ensureAutoRestartRestored();
  }
}
