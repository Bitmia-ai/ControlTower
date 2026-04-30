/**
 * RadioSessionDriver — Phase 3 v0 stub.
 *
 * Session control over WSS is not wired up in this pass. The
 * blocker isn't the protocol (Radio's session.* ops are ready) —
 * it's the SessionStatus shape: CT today derives `status` from a
 * pidfile mtime + transcript freshness check, which Radio doesn't
 * surface yet. Bridging that lands in Phase 3.1 alongside the
 * subscribe.project transcript fan-out.
 */

import type { SessionInfo, SessionRole, SessionStatus } from "@/lib/redeye-types";

import type { SessionDriver } from "@/lib/sessions";
import type { RadioConnection } from "@/lib/radio/client";

export class RadioSessionDriver implements SessionDriver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly conn: RadioConnection) {}

  status(_projectPath: string): SessionStatus {
    // Synchronous interface — Radio's session.status is async, can't
    // bridge cleanly without changing the interface or blocking. For
    // Phase 3 v0, return an empty/idle status so /api/projects can
    // render. Real status arrives with Phase 3.1.
    const idle = (role: SessionRole): SessionInfo => ({
      role,
      pid: null,
      status: "stopped",
      lastActivity: null,
      logFile: "",
    });
    return {
      cto: idle("cto"),
      tester: idle("tester"),
      documenter: idle("documenter"),
    };
  }

  async start(_projectPath: string, _role: SessionRole): Promise<SessionInfo> {
    throw new Error("RadioSessionDriver.start not yet implemented");
  }

  async stop(_projectPath: string, _role: SessionRole): Promise<void> {
    throw new Error("RadioSessionDriver.stop not yet implemented");
  }

  ensureAutoRestartRestored(): void {
    // No-op on Radio side — Radio doesn't currently expose
    // auto-restart restoration. Local-only concept.
  }
}
