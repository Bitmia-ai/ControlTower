/**
 * lib/state-mutex.ts
 *
 * Per-project in-process async mutex used to serialize state.json
 * read-modify-write sequences across concurrent API requests.
 *
 * `atomicWriteJson` (lib/atomic-write.ts) prevents *torn writes* (a reader
 * seeing a half-written file). It does NOT prevent *lost-update* TOCTOU
 * races: two concurrent callers that read state.json, compute independent
 * mutations, and write back will silently overwrite each other — whichever
 * `rename` lands second wins, the other's mutation is gone.
 *
 * The fix is serialization. `withProjectLock(projectPath, fn)` runs `fn`
 * after every previously-queued caller for the same `projectPath` has
 * completed. Different projects are independent (no cross-project
 * blocking), and the lock releases via `finally` so a throwing `fn` does
 * not leak the queue.
 *
 * Implementation: each project key holds the tail of a promise chain.
 * Each new caller chains its work onto the current tail and replaces the
 * tail with its own "release" promise so subsequent callers wait on it.
 *
 * Memory: the `Map` holds at most one promise per active project path.
 * The promise reference is replaced (not appended) per call, so the map
 * size is bounded by the number of distinct projects ever locked
 * (typically 1–3 in this app). Stale resolved promises stay in the map
 * until overwritten, which is fine for a long-lived single-process server.
 *
 * Single-process scope: this mutex protects against intra-process races
 * only. There is no cross-process file lock — Control Tower runs as a
 * single Next.js process, which is the trust boundary documented in the
 * project README.
 */

const locks = new Map<string, Promise<void>>();

export function withProjectLock<T>(
  projectPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(projectPath) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(projectPath, next);
  // Chain onto the previous tail. `previous` never rejects because the tail
  // stored in `locks` is always a bare `new Promise<void>` that only resolves.
  const result = previous.then(() => fn());
  // Release the next waiter regardless of whether `fn` resolved or threw.
  result.then(release, release);
  return result;
}
