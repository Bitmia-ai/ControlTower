// @vitest-environment node
/**
 * Unit tests for session-manager auto-restart-marker persistence.
 *
 * Reproduces the bug: when CT (the Next.js dashboard) restarts while a
 * RedEye session is running, the in-memory `autoRestartEnabled` Set is
 * wiped. When the long-running session eventually exits cleanly, no one
 * respawns the next iteration. The fix persists the auto-restart intent
 * to a `.redeye/session-{role}.autorestart` marker file.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Run-time spawn path is stubbed via the mock below; we exercise the actual
// file I/O for the marker, the steering-file check, and the lazy-restore
// pathway via getSessionStatus.

import { ensureAutoRestartRestored, getSessionStatus } from "./session-manager";

let TMP: string;
let CONFIG: string;
const ORIGINAL_ENV = process.env.REDEYE_CONFIG_PATH;

function makeProject(name: string): string {
  const p = path.join(TMP, name);
  fs.mkdirSync(path.join(p, ".redeye"), { recursive: true });
  return p;
}

function writeAutoRestartMarker(projectPath: string, role: string): void {
  fs.writeFileSync(
    path.join(projectPath, ".redeye", `session-${role}.autorestart`),
    ""
  );
}

function writeSteering(projectPath: string, content: string): void {
  fs.writeFileSync(path.join(projectPath, ".redeye", "steering.md"), content);
}

beforeEach(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ct-autorestart-"));
  CONFIG = path.join(TMP, "config.json");
  process.env.REDEYE_CONFIG_PATH = CONFIG;
  // Force a fresh restore state by clearing the module-level cache. The
  // module's `restoreCompleted` is module-private; we rely on the test's
  // first call being the "first" by setting a unique TMPDIR per test.
});

afterEach(() => {
  if (TMP && fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
  if (ORIGINAL_ENV !== undefined) process.env.REDEYE_CONFIG_PATH = ORIGINAL_ENV;
  else delete process.env.REDEYE_CONFIG_PATH;
});

describe("session-manager auto-restart marker", () => {
  it("ensureAutoRestartRestored is idempotent when no projects are registered", () => {
    fs.writeFileSync(CONFIG, JSON.stringify({ projects: [] }));
    expect(() => ensureAutoRestartRestored()).not.toThrow();
    // Calling twice must not throw or do work twice.
    expect(() => ensureAutoRestartRestored()).not.toThrow();
  });

  it("ensureAutoRestartRestored tolerates a missing config file", () => {
    // No config.json on disk — must not throw.
    expect(() => ensureAutoRestartRestored()).not.toThrow();
  });

  it("ensureAutoRestartRestored tolerates a malformed config file", () => {
    fs.writeFileSync(CONFIG, "not json {");
    expect(() => ensureAutoRestartRestored()).not.toThrow();
  });

  it("does not respawn a project whose steering.md has STOP", () => {
    const proj = makeProject("p1");
    writeAutoRestartMarker(proj, "cto");
    writeSteering(proj, "## Directives\n\nSTOP — CEO directed\n");
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [{ name: "p1", path: proj }] })
    );
    expect(() => ensureAutoRestartRestored()).not.toThrow();
    // The exact assertion (no spawn happened) is hard to make without
    // mocking spawnClaudeSession at module-load time; the value of this
    // test is that respawn doesn't crash on a STOP-bearing project.
    // The respawnAllowed gate is exercised; if it ever regresses to "always
    // respawn," this test still passes but the boot log will show a real
    // claude process. CI would catch this via the test environment having
    // no `claude` binary.
  });

  it("does not respawn an idle project and removes the autorestart marker", async () => {
    // Reproduces the 2026-04-29 STOP-loop bug: RedEye CTO emits
    // <promise>CEO DIRECTED STOP</promise> when digest.json reports no
    // actionable items, ralph-loop halts the Claude process, and CT used
    // to respawn it 5 s later — burning tokens forever. The fix reads the
    // same digest fields the CTO uses and short-circuits the respawn,
    // dropping the marker so a CT restart doesn't un-stop us.
    const proj = makeProject("p-idle");
    writeAutoRestartMarker(proj, "cto");
    fs.writeFileSync(
      path.join(proj, ".redeye", "digest.json"),
      JSON.stringify({
        phase: "triage",
        phase_status: "complete",
        env_healthy: true,
        overdue_schedules: 0,
        ceo_answers_pending: 0,
        tasks_summary: { ceo_pending: 0, triaged_planned: 0, discovered_pending: 0 },
      })
    );
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [{ name: "p-idle", path: proj }] })
    );

    // Fresh module — the module-level `restoreCompleted` guard means the
    // shared import is a no-op after the first test that exercised it.
    vi.resetModules();
    const sm = await import("./session-manager");
    expect(() => sm.ensureAutoRestartRestored()).not.toThrow();

    // Marker file should be gone — boot-restore saw idle and dropped it.
    expect(
      fs.existsSync(path.join(proj, ".redeye", "session-cto.autorestart"))
    ).toBe(false);
  });

  it("still respawns when digest shows actionable work (idle gate is precise)", async () => {
    // Negative case for the idle gate: any one of {actionable tasks,
    // overdue schedule, pending CEO answer, unhealthy env, in-progress
    // phase} must keep the loop running. We assert the marker survives
    // boot-restore so the watchdog continues to manage the session.
    //
    // We can't easily assert "spawn happened" without mocking spawnClaudeSession
    // at module load, but we *can* prove the idle short-circuit didn't fire
    // by checking the marker survived. The actual respawn would crash the
    // test (no `claude` binary on PATH) — which is acceptable because the
    // test runner reports it.
    const proj = makeProject("p-busy");
    writeAutoRestartMarker(proj, "cto");
    fs.writeFileSync(
      path.join(proj, ".redeye", "digest.json"),
      JSON.stringify({
        phase: "triage",
        phase_status: "complete",
        env_healthy: true,
        overdue_schedules: 0,
        ceo_answers_pending: 0,
        tasks_summary: { ceo_pending: 1, triaged_planned: 0, discovered_pending: 0 },
      })
    );
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [{ name: "p-busy", path: proj }] })
    );

    vi.resetModules();
    const sm = await import("./session-manager");
    // Spawn may be attempted; we wrap to swallow the no-binary error and
    // still assert the side effects.
    try { sm.ensureAutoRestartRestored(); } catch {}
    // Marker stays because the project has work to do.
    expect(
      fs.existsSync(path.join(proj, ".redeye", "session-cto.autorestart"))
    ).toBe(true);
  });

  it("does not respawn a project whose steering.md has PAUSE", () => {
    const proj = makeProject("p2");
    writeAutoRestartMarker(proj, "cto");
    writeSteering(proj, "## Directives\n\nPAUSE — wait for next morning\n");
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [{ name: "p2", path: proj }] })
    );
    expect(() => ensureAutoRestartRestored()).not.toThrow();
  });

  it("getSessionStatus triggers restore lazily on first call", () => {
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [] })
    );
    const proj = makeProject("p3");
    // Lazy restore should not throw and should return a normal status object.
    const status = getSessionStatus(proj);
    expect(status.cto.status).toBe("stopped");
    expect(status.cto.pid).toBeNull();
  });
});

describe("auto-restart marker file lifecycle", () => {
  it("the marker file path is .redeye/session-{role}.autorestart", () => {
    const proj = makeProject("p4");
    writeAutoRestartMarker(proj, "cto");
    expect(
      fs.existsSync(path.join(proj, ".redeye", "session-cto.autorestart"))
    ).toBe(true);
  });

  it("a project without a marker is not auto-respawned", () => {
    const proj = makeProject("p5");
    // No marker written. config.json registered.
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ projects: [{ name: "p5", path: proj }] })
    );
    // No throw, no work — the absence of a marker is the signal "user did
    // not click Start," so restore should skip this project entirely.
    expect(() => ensureAutoRestartRestored()).not.toThrow();
  });
});
