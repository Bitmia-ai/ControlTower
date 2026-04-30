import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import type { SessionRole, SessionInfo, SessionStatus } from "./redeye-types";
import { spawnClaudeSession, runClaudeCommand } from "./claude-runner";
import { resolveTranscriptFile } from "./transcript-file-resolver";
import { pruneOrphanWorktrees } from "./worktree-pruner";
import { isProcessRunning } from "./process-utils";

const STALL_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const sessions = new Map<string, Map<SessionRole, number>>();
const autoRestartEnabled = new Set<string>(); // "projectPath:role" keys
// Pending respawn timers per session key — cleared on stop/explicit start to
// prevent the double-spawn race where a Stop+Start during the 5s respawn
// window leaves the original timer to fire AFTER the manual start.
const pendingRespawn = new Map<string, ReturnType<typeof setTimeout>>();

// Track which sessions already have a watcher installed, so the restore-from-disk
// path doesn't double-install when an active session is found at boot.
const watchedSessions = new Set<string>();

const ROLES_WITH_AUTORESTART: SessionRole[] = ["cto"];

// Exported so tests can pin the exact wording. The CTO prompt's structure
// matters: it must invoke `/redeye:start` (the slash command), which in turn
// must successfully bridge to the `redeye:start` skill (skills/start/SKILL.md
// in the redeye plugin). On 2026-04-29 the bridge silently broke and the
// loop wedged for hours emitting "Invoke the redeye:start skill" every turn
// without ever calling the Skill tool. The lock test ensures a future
// well-meaning rewrite ("Run the start skill" / "Use redeye-start" / etc.)
// fails loudly instead of regressing the contract.
export const PROMPTS: Record<SessionRole, string> = {
  cto: 'Run /redeye:start and follow the skill instructions. Begin the autonomous development loop.',
  tester: 'You are the UX Tester. Read .redeye/config.md for the app URL and user personas. Navigate the app using Playwright MCP and report bugs to .redeye/tester-reports.md.',
  documenter: 'You are the Documenter. Read the recent git diff and update CLAUDE.md and project documentation to reflect the changes. Only update factual content.',
};

const MODELS: Record<SessionRole, string> = {
  cto: "sonnet",
  tester: "sonnet",
  documenter: "sonnet",
};

function sessionKey(projectPath: string, role: SessionRole): string {
  return `${path.resolve(projectPath)}:${role}`;
}

function getPid(projectPath: string, role: SessionRole): number | null {
  return sessions.get(path.resolve(projectPath))?.get(role) ?? null;
}

function setPid(projectPath: string, role: SessionRole, pid: number): void {
  const key = path.resolve(projectPath);
  if (!sessions.has(key)) sessions.set(key, new Map());
  sessions.get(key)!.set(role, pid);

  const pidFile = path.join(projectPath, ".redeye", `session-${role}.pid`);
  try {
    fs.writeFileSync(pidFile, String(pid));
  } catch {}
}

function clearPid(projectPath: string, role: SessionRole): void {
  sessions.get(path.resolve(projectPath))?.delete(role);

  const pidFile = path.join(projectPath, ".redeye", `session-${role}.pid`);
  try {
    fs.unlinkSync(pidFile);
  } catch {}
}

/**
 * Auto-restart marker file. Persisting "this session should auto-restart"
 * to disk lets the watchdog rebuild in-memory state after CT itself restarts
 * (Next.js dev hot-reload, prod `npm run build && start`, container restart,
 * crash recovery). Without this, the in-memory `autoRestartEnabled` Set is
 * lost on every CT restart and a cleanly-exiting RedEye iteration leaves the
 * project orphaned with `active: true` in ralph-loop.local.md.
 */
function autoRestartFile(projectPath: string, role: SessionRole): string {
  return path.join(projectPath, ".redeye", `session-${role}.autorestart`);
}

function setAutoRestartFlag(projectPath: string, role: SessionRole): void {
  try {
    fs.mkdirSync(path.join(projectPath, ".redeye"), { recursive: true });
    fs.writeFileSync(autoRestartFile(projectPath, role), "");
  } catch {}
}

function clearAutoRestartFlag(projectPath: string, role: SessionRole): void {
  try {
    fs.unlinkSync(autoRestartFile(projectPath, role));
  } catch {}
}

function hasAutoRestartFlag(projectPath: string, role: SessionRole): boolean {
  try {
    fs.accessSync(autoRestartFile(projectPath, role), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Honor explicit kill switches on disk. We don't auto-respawn a session
 * if the user has written STOP / PAUSE to steering.md — those are the
 * documented ways to halt the loop without losing the autorestart marker.
 */
function respawnAllowed(projectPath: string): boolean {
  try {
    const steering = fs.readFileSync(
      path.join(projectPath, ".redeye", "steering.md"),
      "utf-8"
    );
    if (/^\s*(STOP|PAUSE)\b/im.test(steering)) return false;
  } catch {}
  return true;
}

/**
 * Detect "intentionally idle" state: TRIAGE has nothing to do (no actionable
 * tasks, no overdue schedules, no pending CEO answers, env healthy). When
 * RedEye's CTO is in this state it emits `<promise>CEO DIRECTED STOP</promise>`
 * and ralph-loop halts the Claude Code session cleanly. Without this check,
 * the watchdog would respawn the session 5 s later — exact bug we hit on
 * 2026-04-29 where iters 188+ kept re-running TRIAGE after iter 187 chose STOP.
 *
 * Reads `.redeye/digest.json` (written by `scripts/digest.sh` at the start of
 * each iteration). Returns false on any read/parse error — when in doubt,
 * respawn rather than orphan a project.
 */
function isProjectIdle(projectPath: string): boolean {
  try {
    const raw = fs.readFileSync(
      path.join(projectPath, ".redeye", "digest.json"),
      "utf-8"
    );
    const d = JSON.parse(raw) as {
      phase?: string;
      phase_status?: string;
      env_healthy?: boolean;
      overdue_schedules?: number;
      ceo_answers_pending?: number;
      tasks_summary?: {
        ceo_pending?: number;
        triaged_planned?: number;
        discovered_pending?: number;
      };
    };
    // Phase casing in digest.json drifts (TRIAGE vs triage) depending on
    // which agent last wrote it. Compare case-insensitively. Without this
    // the watchdog kept respawning the CTO even after it emitted a clean
    // CEO-DIRECTED-STOP because isProjectIdle was always returning false.
    if ((d.phase ?? "").toLowerCase() !== "triage") return false;
    if (d.phase_status !== "complete") return false;
    if (d.env_healthy !== true) return false;
    if ((d.overdue_schedules ?? 0) > 0) return false;
    if ((d.ceo_answers_pending ?? 0) > 0) return false;
    const t = d.tasks_summary ?? {};
    const actionable =
      (t.ceo_pending ?? 0) +
      (t.triaged_planned ?? 0) +
      (t.discovered_pending ?? 0);
    return actionable === 0;
  } catch {
    return false;
  }
}

/**
 * Resolve the working directory of a running process. Cross-platform:
 * /proc on Linux, lsof on macOS/BSD. Returns null if unreadable.
 */
function pidCwd(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (process.platform === "linux") {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return null;
    }
  }
  try {
    const out = execFileSync(
      "lsof",
      ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    for (const line of out.split("\n")) {
      if (line.startsWith("n")) return line.slice(1);
    }
  } catch {}
  return null;
}

/**
 * Process-table fallback for an orphan CTO Claude session whose PID we lost.
 *
 * In-memory map and pidfile can both miss a real process when:
 *  - Next.js dev server hot-reloads → in-memory state wiped
 *  - RedEye's start-loop.sh overwrites session-cto.pid with $PPID (its shell)
 *  - ralph-loop respawns claude across iterations with a new PID
 *
 * Scans `ps` for a `claude --print … --plugin-dir … redeye … -p Run /redeye:start`
 * process whose cwd matches the project, and returns its PID.
 */
function findOrphanCtoPid(projectPath: string): number | null {
  const targetPath = path.resolve(projectPath);
  let psOut: string;
  try {
    psOut = execFileSync("ps", ["-eo", "pid=,args="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  const candidates: number[] = [];
  for (const line of psOut.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      !trimmed.includes("claude") ||
      !trimmed.includes("--print") ||
      !trimmed.includes("--plugin-dir") ||
      !trimmed.includes("redeye") ||
      !trimmed.includes("/redeye:start")
    ) {
      continue;
    }
    const m = trimmed.match(/^(\d+)\s/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    if (Number.isFinite(pid) && pid > 0) candidates.push(pid);
  }
  for (const pid of candidates) {
    const cwd = pidCwd(pid);
    if (cwd && path.resolve(cwd) === targetPath) return pid;
  }
  return null;
}

function discoverPid(projectPath: string, role: SessionRole): number | null {
  // Source of truth (in order):
  //   1. In-memory map (this server's spawns)
  //   2. Pidfile on disk (kept fresh by RedEye's stop-hook each iteration)
  //   3. Process-table scan (catches orphans from hot-reload, ralph-loop respawn,
  //      or stale pidfile written by start-loop.sh's $PPID)
  //
  // We deliberately do NOT use log-freshness as a "running" signal — log
  // mtime can stay fresh for ~60 s after the CTO process exits because the
  // last subagent writes flush late, which produced false-positive "running"
  // reports in the dashboard.
  const memPid = getPid(projectPath, role);
  if (memPid !== null && isProcessRunning(memPid)) return memPid;

  const pidFile = path.join(projectPath, ".redeye", `session-${role}.pid`);
  try {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
    if (!isNaN(pid) && isProcessRunning(pid)) {
      // Verify the pid actually belongs to a CTO for THIS project — start-loop.sh
      // writes $PPID which can be any unrelated process if the file goes stale.
      const cwd = pidCwd(pid);
      if (cwd && path.resolve(cwd) === path.resolve(projectPath)) {
        const key = path.resolve(projectPath);
        if (!sessions.has(key)) sessions.set(key, new Map());
        sessions.get(key)!.set(role, pid);
        return pid;
      }
    }
    try { fs.unlinkSync(pidFile); } catch {}
  } catch {}

  // Process-table fallback (only for CTO — other roles spawn rarely)
  if (role === "cto") {
    const orphan = findOrphanCtoPid(projectPath);
    if (orphan !== null) {
      const key = path.resolve(projectPath);
      if (!sessions.has(key)) sessions.set(key, new Map());
      sessions.get(key)!.set(role, orphan);
      // Persist so next call doesn't pay the ps+lsof cost
      try {
        fs.writeFileSync(pidFile, String(orphan));
      } catch {}
      return orphan;
    }
  }

  return null;
}

function makeSessionInfo(projectPath: string, role: SessionRole): SessionInfo {
  const pid = discoverPid(projectPath, role);
  const running = pid !== null && isProcessRunning(pid);
  if (pid !== null && !running) clearPid(projectPath, role);

  // Determine lastActivity from transcript file mtime
  let lastActivity: number | null = null;
  if (role === "cto") {
    const transcriptFile = resolveTranscriptFile(projectPath);
    if (transcriptFile) {
      try {
        const stat = fs.statSync(transcriptFile);
        lastActivity = stat.mtimeMs;
      } catch {
        // transcript file unreadable — lastActivity stays null
      }
    }
  }

  // Detect stall: process alive but no transcript activity for >10 min.
  // Grace period: don't flag stall if process started within the last 2 min.
  const pidFile = path.join(projectPath, ".redeye", `session-${role}.pid`);
  let processAge = Infinity;
  try {
    const pidStat = fs.statSync(pidFile);
    processAge = Date.now() - pidStat.mtimeMs;
  } catch {}
  const stalled =
    running &&
    processAge > 120_000 &&
    lastActivity !== null &&
    Date.now() - lastActivity > STALL_THRESHOLD_MS;

  return {
    role,
    pid: running ? pid : null,
    status: stalled ? "stalled" : running ? "running" : "stopped",
    lastActivity,
    logFile: path.join(projectPath, ".redeye", `session-${role}.jsonl`),
  };
}

export function getSessionStatus(projectPath: string): SessionStatus {
  ensureAutoRestartRestored();
  return {
    cto: makeSessionInfo(projectPath, "cto"),
    tester: makeSessionInfo(projectPath, "tester"),
    documenter: makeSessionInfo(projectPath, "documenter"),
  };
}

/**
 * Install exit + stall watchers on an already-known PID. Used by both
 * `spawnAndWatch` (after spawning) and `restoreAutoRestartFromDisk` (when
 * an existing process is rediscovered at boot — e.g. after CT restarted
 * without the in-memory state).
 */
function installSessionWatchers(
  projectPath: string,
  role: SessionRole,
  pid: number,
  prompt: string,
  model: string
): void {
  const key = sessionKey(projectPath, role);
  if (watchedSessions.has(key)) return; // already watching this PID slot
  watchedSessions.add(key);

  // Stall detection: check every 60 s if transcript has been updated
  let stallCheckInterval: ReturnType<typeof setInterval> | null = null;
  function clearStallInterval() {
    if (stallCheckInterval !== null) {
      clearInterval(stallCheckInterval);
      stallCheckInterval = null;
    }
  }

  const checkInterval = setInterval(() => {
    if (!autoRestartEnabled.has(key)) {
      clearInterval(checkInterval);
      watchedSessions.delete(key);
      return;
    }
    if (!isProcessRunning(pid)) {
      clearInterval(checkInterval);
      clearStallInterval();
      watchedSessions.delete(key);
      clearPid(projectPath, role);
      // Don't respawn if the human asked to stop via steering.md.
      if (!respawnAllowed(projectPath)) {
        return;
      }
      // Don't respawn if RedEye told us it intentionally STOPped because
      // backlog is empty. The CTO emits `<promise>CEO DIRECTED STOP</promise>`
      // exactly when digest.json shows no actionable items; respawning here
      // would create the exact ping-pong we saw on 2026-04-29 (iter 187 STOP
      // → CT respawns 5 s later → iter 188 TRIAGE → STOP → respawn → ...).
      // Drop the autorestart flag too so a CT restart doesn't un-stop us.
      if (role === "cto" && isProjectIdle(projectPath)) {
        autoRestartEnabled.delete(key);
        clearAutoRestartFlag(projectPath, role);
        return;
      }
      // Re-spawn after a short delay. Track the timer so an explicit
      // Stop+Start during the window can cancel it and avoid double-spawn.
      const t = setTimeout(() => {
        pendingRespawn.delete(key);
        if (
          autoRestartEnabled.has(key) &&
          respawnAllowed(projectPath) &&
          !(role === "cto" && isProjectIdle(projectPath))
        ) {
          // Defensive: drop the watcher key before respawning so the new
          // PID's installSessionWatchers call installs fresh watchers
          // instead of short-circuiting on the prior key. The exit-check
          // path above already deleted it, but the stall path can also
          // route through spawnAndWatch and we want this site to be
          // robust regardless of how we got here.
          watchedSessions.delete(key);
          spawnAndWatch(projectPath, role, prompt, model);
        }
      }, 5000);
      pendingRespawn.set(key, t);
    }
  }, 10_000);

  // Stall detection only runs for the CTO role; tester/documenter are
  // shorter-lived and don't have the same long-tail stall pattern.
  if (role === "cto") {
    stallCheckInterval = setInterval(() => {
      if (!autoRestartEnabled.has(key)) {
        clearStallInterval();
        return;
      }
      if (!isProcessRunning(pid)) {
        // exit-check interval will handle restart
        clearStallInterval();
        return;
      }
      const info = makeSessionInfo(projectPath, role);
      if (info.status === "stalled") {
        process.stderr.write(
          `[session-manager] stall detected for ${role} — restarting\n`
        );
        clearStallInterval();
        clearInterval(checkInterval);
        // SIGTERM with SIGKILL fallback after 10 s
        try {
          process.kill(pid, "SIGTERM");
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code ?? String(err);
          process.stderr.write(
            `[session-manager] SIGTERM failed for ${role} pid=${pid}: ${code}\n`
          );
        }
        const killDeadline = setTimeout(() => {
          try {
            if (isProcessRunning(pid)) process.kill(pid, "SIGKILL");
          } catch (err: unknown) {
            const code = (err as NodeJS.ErrnoException).code ?? String(err);
            process.stderr.write(
              `[session-manager] SIGKILL failed for ${role} pid=${pid}: ${code}\n`
            );
          }
        }, 10_000);
        // Wait for process to exit then re-spawn.
        // Hard timeout: if the process still hasn't exited 30 s after SIGKILL
        // was sent (i.e. 40 s after SIGTERM), give up and log an error rather
        // than polling forever (handles zombie / D-state processes).
        let waitForExit: ReturnType<typeof setInterval>;
        const waitForExitDeadline = setTimeout(() => {
          clearInterval(waitForExit);
          clearTimeout(killDeadline);
          clearPid(projectPath, role);
          process.stderr.write(
            `[session-manager] pid=${pid} did not exit after SIGKILL — ` +
            `possible zombie/D-state process. Skipping re-spawn for ${role}.\n`
          );
        }, 40_000);
        waitForExit = setInterval(() => {
          if (!autoRestartEnabled.has(key)) {
            // stopSession was called — abort polling to avoid wasteful spinning
            clearInterval(waitForExit);
            clearTimeout(killDeadline);
            clearTimeout(waitForExitDeadline);
            return;
          }
          if (!isProcessRunning(pid)) {
            clearInterval(waitForExit);
            clearTimeout(killDeadline);
            clearTimeout(waitForExitDeadline);
            clearPid(projectPath, role);
            // Drop the watcher key before respawning — the stall path
            // didn't go through the exit-check delete site, and without
            // this the new PID's installSessionWatchers would short-circuit.
            watchedSessions.delete(key);
            spawnAndWatch(projectPath, role, prompt, model);
          }
        }, 1_000);
      }
    }, 60_000);
  }
}

/**
 * Spawn a fresh Claude session and install watchers on it. The split between
 * `spawnAndWatch` and `installSessionWatchers` exists so the boot-restore path
 * (which finds an already-running PID) can attach watchers without spawning.
 */
function spawnAndWatch(
  projectPath: string,
  role: SessionRole,
  prompt: string,
  model: string
): SessionInfo {
  const { pid, logFile } = spawnClaudeSession(projectPath, role, prompt, model);
  setPid(projectPath, role, pid);
  installSessionWatchers(projectPath, role, pid, prompt, model);
  return { role, pid, status: "running", lastActivity: null, logFile };
}

/**
 * After CT itself restarts, the in-memory `autoRestartEnabled` Set is empty.
 * We rebuild it from on-disk markers and either reattach watchers to live
 * processes or respawn dead ones. This is the fix for the bug where a long
 * RedEye session that exits cleanly would leave the project orphaned because
 * CT had no record of "this session should keep running."
 *
 * Idempotent: safe to call multiple times. Won't double-watch or double-spawn.
 */
let restoreCompleted = false;
function restoreAutoRestartFromDisk(): void {
  if (restoreCompleted) return;
  restoreCompleted = true;

  const configPath =
    process.env.REDEYE_CONFIG_PATH ||
    path.join(os.homedir(), ".redeye", "config.json");

  let projects: { path: string }[] = [];
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.projects)) projects = parsed.projects;
  } catch {
    return; // no projects registered yet — nothing to restore
  }

  for (const proj of projects) {
    if (!proj?.path) continue;
    for (const role of ROLES_WITH_AUTORESTART) {
      if (!hasAutoRestartFlag(proj.path, role)) continue;
      const key = sessionKey(proj.path, role);
      autoRestartEnabled.add(key);

      const pid = discoverPid(proj.path, role);
      if (pid !== null && isProcessRunning(pid)) {
        // Process is alive (orphan-detected via findOrphanCtoPid or pidfile).
        // Re-install watchers so when it eventually exits we respawn.
        installSessionWatchers(
          proj.path,
          role,
          pid,
          PROMPTS[role],
          MODELS[role]
        );
      } else if (
        respawnAllowed(proj.path) &&
        !(role === "cto" && isProjectIdle(proj.path))
      ) {
        // Process is dead, user hasn't asked to stop, and RedEye isn't sitting
        // in the idle/STOP state. Spawn fresh. (See the watchdog branch above
        // for the full rationale on the idle gate.)
        try {
          spawnAndWatch(proj.path, role, PROMPTS[role], MODELS[role]);
        } catch (err) {
          process.stderr.write(
            `[session-manager] restore: failed to respawn ${role} for ${proj.path}: ${err}\n`
          );
        }
      } else if (role === "cto" && isProjectIdle(proj.path)) {
        // Idle on boot — drop the flag so we don't keep retrying every poll.
        autoRestartEnabled.delete(key);
        clearAutoRestartFlag(proj.path, role);
      }
    }
  }
}

/**
 * Public entry point — every API request that touches session state should
 * call this first. Lazy-init style: cheap after the first call (no-op).
 */
export function ensureAutoRestartRestored(): void {
  restoreAutoRestartFromDisk();
}

export async function startSession(
  projectPath: string,
  role: SessionRole
): Promise<SessionInfo> {
  ensureAutoRestartRestored();

  const existing = discoverPid(projectPath, role);
  if (existing !== null && isProcessRunning(existing)) {
    // Process is already running — make sure watchers are wired up too.
    // (Covers the case where boot-restore picked up an orphan but the API
    // request raced ahead before lazy-init ran.)
    installSessionWatchers(projectPath, role, existing, PROMPTS[role], MODELS[role]);
    setAutoRestartFlag(projectPath, role);
    autoRestartEnabled.add(sessionKey(projectPath, role));
    return makeSessionInfo(projectPath, role);
  }

  // Enable auto-restart for this session and cancel any pending respawn
  // timer (defends against double-spawn if the user clicks Stop+Start fast).
  const key = sessionKey(projectPath, role);
  const pending = pendingRespawn.get(key);
  if (pending) {
    clearTimeout(pending);
    pendingRespawn.delete(key);
  }
  autoRestartEnabled.add(key);
  // Persist intent: survives CT restarts so the watchdog can resume the loop
  // even after this Node process is gone.
  setAutoRestartFlag(projectPath, role);

  // Sweep worktrees abandoned by previously-killed claude processes before
  // spawning a fresh one. Leaked worktrees inside the project root cause
  // Turbopack to walk duplicate trees and balloon the dev server's heap.
  pruneOrphanWorktrees(projectPath);

  return spawnAndWatch(projectPath, role, PROMPTS[role], MODELS[role]);
}

export async function stopSession(
  projectPath: string,
  role: SessionRole
): Promise<void> {
  ensureAutoRestartRestored();
  const key = sessionKey(projectPath, role);
  autoRestartEnabled.delete(key);
  // Drop the persisted flag too — otherwise the next CT restart would
  // un-stop the session.
  clearAutoRestartFlag(projectPath, role);
  const pending = pendingRespawn.get(key);
  if (pending) {
    clearTimeout(pending);
    pendingRespawn.delete(key);
  }

  const pid = discoverPid(projectPath, role);
  if (pid === null || !isProcessRunning(pid)) {
    clearPid(projectPath, role);
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {}

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && isProcessRunning(pid)) {
    await new Promise((r) => setTimeout(r, 500));
  }

  if (isProcessRunning(pid)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }

  clearPid(projectPath, role);

  // After the claude process is gone, sweep any worktrees it left locked.
  // Same rationale as in startSession: leaked worktrees explode `next dev`.
  pruneOrphanWorktrees(projectPath);
}
