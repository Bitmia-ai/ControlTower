/**
 * Returns true if a process with the given PID is running. Uses signal 0
 * (existence probe) — no signal is sent. Returns false on any error.
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
