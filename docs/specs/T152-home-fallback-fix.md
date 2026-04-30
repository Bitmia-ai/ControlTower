# T152 — Fix HOME fallback: replace literal "~" / "/root" with os.homedir() across 3 sites

**Status:** planned  
**Priority:** P0  
**Type:** bug  
**Iteration planned:** 174

---

## Context

Three files construct paths using `process.env.HOME` with literal string fallbacks that
Node's `path.join` does **not** expand:

| File | Line | Fallback | Risk |
|------|------|----------|------|
| `lib/projects.ts` | 10 | `\|\| "~"` | Creates a literal `~/.redeye/config.json` relative to cwd — i.e. a directory named `~` in the working directory |
| `lib/claude-runner.ts` | 8 | `?? "/root"` | On macOS HOME is never `/root`; silently uses the wrong user directory, masking any misconfiguration |
| `lib/session-manager.ts` | 456 | `?? "/root"` | Same as above, in the `restoreAutoRestartFromDisk()` function |

The documented Node.js API for the home directory is `os.homedir()`. It reads the
home directory from the OS (not from `process.env.HOME`) and therefore works correctly
even when `HOME` is unset in the environment. All three sites already import or could
easily import `os`.

Notably, `lib/projects.ts` already imports `os` (used at line 113 for `os.homedir()` in
`addProject`), making the fix at line 10 a one-line change with zero new imports.
`lib/session-manager.ts` also already imports `path` — it just needs an `import os from "os"` added.
`lib/claude-runner.ts` does not currently import `os` — a two-line change.

---

## Architecture Decisions

### AD-1: Use `os.homedir()` not `process.env.HOME`

`os.homedir()` is the Node.js canonical home-directory API (docs: https://nodejs.org/api/os.html#oshomedir).
It calls the OS-level `getpwuid(getuid())` on POSIX and `USERPROFILE` / `SHGetFolderPath` on Windows —
it does not depend on the `HOME` environment variable. The fallback sites existed precisely because
`process.env.HOME` can be unset; `os.homedir()` eliminates the need for any fallback at all.

### AD-2: No behavioral change when HOME is set

When `process.env.HOME` is set (the normal case), `os.homedir()` returns the same directory.
The fix is a pure improvement of the degenerate case.

### AD-3: `REDEYE_CONFIG_PATH` override is preserved

Both `lib/projects.ts:getConfigPath()` and `lib/session-manager.ts:restoreAutoRestartFromDisk()`
check `process.env.REDEYE_CONFIG_PATH` first. The fix only touches the fallback arm, not the primary
env-var override. Tests already set `REDEYE_CONFIG_PATH` to bypass home-path logic entirely, so the
new unit tests for the HOME-unset case must temporarily delete `REDEYE_CONFIG_PATH` as well.

### AD-4: Unit tests must `delete process.env.HOME` to exercise the fix

The fix removes the literal-string code path. Tests that lock in the behavior must:
1. `delete process.env.HOME` (and restore in afterEach)
2. `delete process.env.REDEYE_CONFIG_PATH` (so the override doesn't short-circuit)
3. Assert that the returned path starts with `os.homedir()` (not `"~"` or `"/root"`)

### AD-5: Session-manager test scope is narrow

`restoreAutoRestartFromDisk()` is a module-level side-effectful function that reads disk.
The unit test for it only needs to verify that the `configPath` it constructs does not
start with `/root` or `~` when `HOME` is unset. We can read the exported constant
`REDEYE_PLUGIN_DIR` from `claude-runner.ts` directly to test that module without spawning.

---

## Sub-task Decomposition

### ST-1 — Fix `lib/projects.ts:getConfigPath()` — replace `|| "~"` with `os.homedir()`

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none |
| Agent type | Dev (sonnet) |
| Test strategy | Add test to `lib/projects.test.ts`: `delete process.env.HOME`, `delete process.env.REDEYE_CONFIG_PATH`, call `getConfigPath()`, assert result starts with `os.homedir()` and ends with `.redeye/config.json` |
| Acceptance criteria | `getConfigPath()` returns a path starting with `os.homedir()` when `HOME` is unset; `os` import is already present (no new import needed); `|| "~"` literal is removed |
| Status | done |

**Implementation note:**
- `lib/projects.ts` line 10: change `process.env.HOME || "~"` to `os.homedir()`
- Export `getConfigPath` is already exported — tests can call it directly
- Add new `describe("getConfigPath")` block in `lib/projects.test.ts`

### ST-2 — Fix `lib/claude-runner.ts:REDEYE_PLUGIN_DIR` — replace `?? "/root"` with `os.homedir()`

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none (parallel with ST-1) |
| Agent type | Dev (sonnet) |
| Test strategy | Add test to `lib/claude-runner.test.ts`: delete `process.env.HOME` and `process.env.REDEYE_PLUGIN_DIR`, re-import (or reset module) to get `REDEYE_PLUGIN_DIR`, assert it starts with `os.homedir()` and ends with `redeye` |
| Acceptance criteria | `REDEYE_PLUGIN_DIR` constant does not contain `/root` when `HOME` is unset; `import os from "os"` added; `?? "/root"` literal removed |
| Status | done |

**Implementation note:**
- `lib/claude-runner.ts` line 6-8: add `import os from "os"` at top; change `process.env.HOME ?? "/root"` to `os.homedir()`
- `REDEYE_PLUGIN_DIR` is a module-level constant evaluated at import time. Test with `vi.resetModules()` + dynamic `import()` inside the test body after deleting `HOME`, so the module re-evaluates the constant.

### ST-3 — Fix `lib/session-manager.ts:restoreAutoRestartFromDisk()` — replace `?? "/root"` with `os.homedir()`

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none (parallel with ST-1 and ST-2) |
| Agent type | Dev (sonnet) |
| Test strategy | Verify existing `lib/session-manager.test.ts` passes; add a focused assertion that the configPath built inside `restoreAutoRestartFromDisk` when `HOME` is unset does not start with `/root`. This may require a small refactor to extract `buildConfigPath()` as a testable helper, or verify indirectly by checking the mock fs.readFileSync call target |
| Acceptance criteria | `?? "/root"` literal removed from session-manager.ts:456; `import os from "os"` added (or confirmed present); all existing session-manager tests still pass |
| Status | done |

**Implementation note:**
- `lib/session-manager.ts` line 456: add `import os from "os"` at top of file (check if already imported first); change `process.env.HOME ?? "/root"` to `os.homedir()`
- The `configPath` local variable inside `restoreAutoRestartFromDisk` is not exported. Testing strategy: the function reads from `configPath` via `fs.readFileSync`. Existing tests already mock `fs`. Add an assertion that `mockReadFileSync` was called with a path starting with `os.homedir()`, not `/root`.

### ST-4 — Run full test suite + typecheck

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1, ST-2, ST-3 |
| Agent type | Dev (sonnet) |
| Test strategy | `npx vitest run` must pass >= 1388 tests (net gain expected from new tests in ST-1, ST-2, ST-3); `npm run typecheck` exits 0 |
| Acceptance criteria | Zero regressions; new HOME-unset tests pass; typecheck clean |
| Status | done |

---

## Overall Acceptance Criteria

1. `lib/projects.ts:getConfigPath()` uses `os.homedir()` — no `|| "~"` literal.
2. `lib/claude-runner.ts:REDEYE_PLUGIN_DIR` uses `os.homedir()` — no `?? "/root"` literal.
3. `lib/session-manager.ts:restoreAutoRestartFromDisk()` uses `os.homedir()` — no `?? "/root"` literal.
4. Unit tests cover the `HOME`-unset case for all three sites; each test asserts the path starts with `os.homedir()`.
5. `npx vitest run` passes with >= 1388 tests passing; `npm run typecheck` exits 0.
6. No behavioral change when `HOME` is set (existing test suite continues to pass unmodified).

---

## Questions

None. `os.homedir()` is the unambiguous correct fix; no CEO input required.
