// Lightweight structured logger.
//
// A thin wrapper over the native `console.*` methods that adds:
//   1. A `[scope]` prefix so call sites are searchable by area.
//   2. Level filtering via the `LOGGER_LEVEL` env var so vitest can silence
//      best-effort warnings/errors without losing them in production.
//
// Levels in ascending severity order: info < warn < error.
//
//   LOGGER_LEVEL=silent  → no output
//   LOGGER_LEVEL=error   → only error()
//   LOGGER_LEVEL=warn    → warn() + error()
//   LOGGER_LEVEL=info    → all (default)
//   unset                → same as info
//
// The level is resolved per-call (not cached at module load) so vitest's
// `vi.stubEnv` works in unit tests without juggling `vi.resetModules()`
// + dynamic imports. This costs one map lookup per log call — negligible
// for the handful of best-effort callers in this codebase.

type Level = "info" | "warn" | "error";

// Higher rank == more verbose. Emit when SEVERITY_RANK[callLevel] <= effective.
const SEVERITY_RANK: Record<Level, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const EFFECTIVE_RANK: Record<string, number> = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
};

function effectiveRank(): number {
  const raw = process.env.LOGGER_LEVEL;
  if (raw === undefined || raw === "") return EFFECTIVE_RANK.info;
  const rank = EFFECTIVE_RANK[raw];
  return rank === undefined ? EFFECTIVE_RANK.info : rank;
}

function shouldEmit(level: Level): boolean {
  return SEVERITY_RANK[level] <= effectiveRank();
}

export function info(scope: string, msg: string, ...meta: unknown[]): void {
  if (!shouldEmit("info")) return;
  // eslint-disable-next-line no-console
  console.log(`[INFO] [${scope}] ${msg}`, ...meta);
}

export function warn(scope: string, msg: string, ...meta: unknown[]): void {
  if (!shouldEmit("warn")) return;
  // eslint-disable-next-line no-console
  console.warn(`[WARN] [${scope}] ${msg}`, ...meta);
}

export function error(scope: string, msg: string, ...meta: unknown[]): void {
  if (!shouldEmit("error")) return;
  // eslint-disable-next-line no-console
  console.error(`[ERROR] [${scope}] ${msg}`, ...meta);
}
