# T154 — Security: scrub /home/user/ paths from tracked source

**Status:** planned  
**Priority:** P0 — security/publish-readiness  
**Assigned iteration:** 172

---

## Investigation findings

Running `git ls-files | xargs grep -l "home/user"` against the full tracked file set returns exactly two files:

- `.redeye/state.json` — contains `/home/user/` in `task_title`, `phase_progress.triage` log text, and `iteration_log[0].outcome` text
- `.redeye/status.md` — contains `/home/user/` in task headline and status summary lines

All source files previously flagged in the task description (e2e specs, lib test fixtures, worktree-pruner comment, transcript-file-resolver comment) have already been cleaned in prior iterations. The `lib/CLAUDE.md` already mandates `/tmp/...` fixtures. The e2e specs use `/tmp/haze`, test files use `os.homedir()`-relative paths or `/tmp/my-project`.

**The real scope:** `.redeye/state.json` and `.redeye/status.md` are tracked by git (3 `.redeye/` files were committed in the initial commit before `.redeye/` was added to `.gitignore`; `git ls-files` confirms they remain tracked). These files contain the task title and CTO log entries that mention the `/home/user/` string — not functional file paths, but the string is still present in tracked source and will appear in `git grep "/home/user"`.

---

## Architecture decisions

### AD-1: Clean tracked .redeye/ orchestration files

The `/home/user/` occurrences in `.redeye/state.json` and `.redeye/status.md` are metadata strings (task titles, log narrative). They must be replaced with a generic placeholder so `git grep "/home/user"` returns 0 hits.

Replacement strategy:
- In task titles, descriptions, and log narrative: replace `/home/user/` with `/home/user/` (documentation/prose context)
- The task title in `state.json` will read: `"Security: scrub /home/user/ paths from tracked test fixtures and lib comments"` — this faithfully describes what was done without leaking the developer username

### AD-2: Untrack .redeye/ files (optional, separate from this task)

These files being tracked is the root cause — they should not be in git at all given `.gitignore` says `.redeye/`. However, removing them from git tracking (`git rm --cached`) is a separate concern with its own risk surface (history rewrite, CI implications). This task does NOT perform that operation. It only scrubs the strings so `git grep` passes.

### AD-3: No source or test changes needed

All lib, app, e2e, and component source files are already clean. The `lib/CLAUDE.md` already documents the `/tmp/...` fixture convention. No vitest tests need modification.

---

## Sub-task decomposition

### ST-1: Scrub .redeye/state.json

**Size:** S  
**Dependencies:** none  
**Agent type:** Dev (generic)  
**Files:** `.redeye/state.json`

Replace all occurrences of `/home/user/` in `.redeye/state.json` with `/home/user/`. The occurrences are in:
- Line 8: `task_title` value
- Line 14: `phase_progress.triage` narrative string
- Line 65: `iteration_log[0].outcome` narrative string

Do NOT modify any JSON structure, only the string values. Validate JSON remains well-formed after edit.

**Test strategy:** `git grep "/home/user" .redeye/state.json` returns 0 hits. `node -e "JSON.parse(require('fs').readFileSync('.redeye/state.json','utf8'))"` exits 0.

**Acceptance criteria:**
- `.redeye/state.json` parses as valid JSON
- `git grep "/home/user" .redeye/state.json` returns 0 hits
- Task semantics preserved (task_title still describes the security task correctly)

**Status:** done

---

### ST-2: Scrub .redeye/status.md

**Size:** S  
**Dependencies:** none (can run in parallel with ST-1)  
**Agent type:** Dev (generic)  
**Files:** `.redeye/status.md`

Replace all occurrences of `/home/user/` in `.redeye/status.md` with `/home/user/`. The occurrences are in:
- Line 5: next task headline
- Line 18: highest priority item summary
- Line 40: T154 description bullet

**Test strategy:** `git grep "/home/user" .redeye/status.md` returns 0 hits.

**Acceptance criteria:**
- `.redeye/status.md` contains no `/home/user/` strings
- File remains valid markdown
- Status summary still accurately describes the task

**Status:** done

---

### ST-3: Final verification

**Size:** S  
**Dependencies:** ST-1, ST-2 both complete  
**Agent type:** Dev (generic)

Run the acceptance gate commands and confirm the test suite is unchanged.

**Commands:**
```
git grep "/home/user"
npx vitest run --reporter=dot
```

**Acceptance criteria:**
- `git grep "/home/user"` returns 0 hits (exit 1, no output)
- 1388/1388 tests pass (no regressions — these are metadata-only edits)

**Status:** done

---

## Questions posted to CEO

None. The scope is fully deterministic from code inspection. No architectural ambiguity.

---

## Commit plan

Single commit covering ST-1 + ST-2 + ST-3:
```
chore: scrub /home/user/ from tracked .redeye state files (T154)
```

Files: `.redeye/state.json`, `.redeye/status.md`
