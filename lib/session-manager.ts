import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import type { SessionRole, SessionInfo, SessionStatus } from "./redeye-types";
import { spawnClaudeSession, runClaudeCommand } from "./claude-runner";
import { resolveTranscriptFile } from "./transcript-file-resolver";

const STALL_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const sessions = new Map<string, Map<SessionRole, number>>();
const autoRestartEnabled = new Set<string>(); // "projectPath:role" keys
// Pending respawn timers per session key — cleared on stop/explicit start to
// prevent the double-spawn race where a Stop+Start during the 5s respawn
// window leaves the original timer to fire AFTER the manual start.
const pendingRespawn = new Map<string, ReturnType<typeof setTimeout>>();

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

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
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
  return {
    cto: makeSessionInfo(projectPath, "cto"),
    tester: makeSessionInfo(projectPath, "tester"),
    documenter: makeSessionInfo(projectPath, "documenter"),
  };
}

function spawnAndWatch(
  projectPath: string,
  role: SessionRole,
  prompt: string,
  model: string
): SessionInfo {
  const { pid, logFile } = spawnClaudeSession(projectPath, role, prompt, model);
  setPid(projectPath, role, pid);

  // Watch for process exit and auto-restart if enabled
  const key = sessionKey(projectPath, role);

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
      return;
    }
    if (!isProcessRunning(pid)) {
      clearInterval(checkInterval);
      clearStallInterval();
      clearPid(projectPath, role);
      // Re-spawn after a short delay. Track the timer so an explicit
      // Stop+Start during the window can cancel it and avoid double-spawn.
      const t = setTimeout(() => {
        pendingRespawn.delete(key);
        if (autoRestartEnabled.has(key)) {
          spawnAndWatch(projectPath, role, prompt, model);
        }
      }, 5000);
      pendingRespawn.set(key, t);
    }
  }, 10_000);

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
            spawnAndWatch(projectPath, role, prompt, model);
          }
        }, 1_000);
      }
    }, 60_000);
  }

  return { role, pid, status: "running", lastActivity: null, logFile };
}

export async function startSession(
  projectPath: string,
  role: SessionRole
): Promise<SessionInfo> {
  const existing = discoverPid(projectPath, role);
  if (existing !== null && isProcessRunning(existing)) {
    return makeSessionInfo(projectPath, role);
  }

  const prompts: Record<SessionRole, string> = {
    cto: 'Run /redeye:start and follow the skill instructions. Begin the autonomous development loop.',
    tester: 'You are the UX Tester. Read .redeye/config.md for the app URL and user personas. Navigate the app using Playwright MCP and report bugs to .redeye/tester-reports.md.',
    documenter: 'You are the Documenter. Read the recent git diff and update CLAUDE.md and project documentation to reflect the changes. Only update factual content.',
  };

  const models: Record<SessionRole, string> = {
    cto: "sonnet",
    tester: "sonnet",
    documenter: "sonnet",
  };

  // Enable auto-restart for this session and cancel any pending respawn
  // timer (defends against double-spawn if the user clicks Stop+Start fast).
  const key = sessionKey(projectPath, role);
  const pending = pendingRespawn.get(key);
  if (pending) {
    clearTimeout(pending);
    pendingRespawn.delete(key);
  }
  autoRestartEnabled.add(key);

  return spawnAndWatch(projectPath, role, prompts[role], models[role]);
}

export async function stopSession(
  projectPath: string,
  role: SessionRole
): Promise<void> {
  const key = sessionKey(projectPath, role);
  autoRestartEnabled.delete(key);
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
}
