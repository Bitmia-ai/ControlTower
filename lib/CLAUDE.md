# `lib/` — domain logic

Per-directory notes that override or extend the root [CLAUDE.md](../CLAUDE.md). Read the root first.

## Rules specific to `lib/`

- **No framework coupling.** No `next/*`, no `react/*`, no `app/*` imports. `lib/` modules must be importable from a vanilla Node script, the CLI in `bin/`, and tests.
- **Hooks live here too** (`use-*.ts(x)`). They may import React, but only React — not Next.js APIs.
- **Pure functions wherever possible.** Prefer returning data over mutating arguments.
- **Errors:** throw typed errors at the boundary; let API route handlers translate them to HTTP. Don't `console.error` in lib code unless it's a true side-effect (`session-manager.ts` is the exception).

## Hot files

| File | Owns | Watch out for |
|------|------|---------------|
| `redeye-parsers.ts` | `tasks.md`, `changelog.md`, `inbox.md` parsing | Section-boundary regressions — there are regression tests for the `## Discovered` / `## Triaged` / `## CEO Requests` headers; any change must preserve them |
| `redeye-files.ts` | High-level reads/writes of `.redeye/*` | `safeRedeyePath` is the gate — every file access must go through it |
| `session-manager.ts` | In-memory CTO process registry | Stop is a SIGTERM with 10s SIGKILL fallback. Never `kill(-9)` directly. |
| `claude-runner.ts` | `spawn('claude', [...])` invocations | Argument-array form only. Rotates session log at 5 MB. |
| `transcript-file-resolver.ts` | Mapping project path → JSONL | Path-mangling: `/` → `-`, `~/.claude/projects/<encoded>/`. Tests cover the encoding. |
| `cost-calculator.ts` | Sum `cost_usd` from a transcript | mtime+size memo; do not invalidate on read |
| `cost-history.ts` | Per-task cost snapshots | Snapshots taken at `done` transitions, never overwritten |
| `git-commit-push.ts` | Local git ops | **Commits only, never pushes.** Don't add a push code path. |
| `markdown-sanitize.ts` | DOMPurify wrapper | All RedEye-authored markdown rendered in the UI passes through here; strips U+2028/U+2029 |
| `atomic-write.ts` | Temp-file + rename writes | Use for any state file that must survive crashes |
| `state-mutex.ts` | Per-project async mutex (`withProjectLock`) | Serialize concurrent writes to inbox.md + state.json |
| `process-utils.ts` | Process-existence helpers | Extracted from session-manager + worktree-pruner; no other deps |
| `fetch-utils.ts` | `fetchJsonWithTimeout` | Extracted from cost-card + velocity-card; use for all card data fetches |
| `promise-pool.ts` | Order-preserving bounded concurrency | Pre-existing; reuse instead of writing new pools |

## Test conventions

- Co-located `*.test.ts(x)` for unit tests
- `__tests__/` for ports and integration-flavored tests
- Fixture paths: `/tmp/haze`, `/tmp/my-project`, `/tmp/control-tower` — **never** real local paths
- The encoded form for those is `-tmp-haze`, `-tmp-my-project`, `-tmp-control-tower` (path-mangling)

## Adding a new module

1. Pure-function first. State only when necessary.
2. Co-located test file.
3. Export public API as named exports (no default exports).
4. If it spawns a subprocess, use `spawn(cmd, [args])` and add a kill path.
5. If it touches disk, use `atomic-write.ts` for state and `safeRedeyePath` for paths.
