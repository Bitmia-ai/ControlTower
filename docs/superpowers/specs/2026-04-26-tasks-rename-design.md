# Backlog → Tasks Rename + UI Restructure (Spec 1)

**Date:** 2026-04-26
**Status:** Approved (awaiting implementation plan)
**Scope:** RedEye plugin (~/redeye), ControlTower (~/ControlTower), 2 managed projects (~/ControlTower, ~/haze)
**Companion:** Spec 2 (subtask decomposition under the new T- namespace) — separate document, depends on this one shipping first.

---

## Goal

Replace the "Backlog / BL-N" terminology with "Tasks / T<N>" across the RedEye plugin, the ControlTower codebase, and the existing managed projects. Restructure ControlTower's renamed Tasks tab so non-active items live in a single flat "Backlog" subsection alongside the existing Done and Won't Do sections.

Single coherent ship — both the plugin source rename and the ControlTower-side rename land together so there's never an in-flight "RedEye says tasks.md, ControlTower reads backlog.md" mismatch.

## Out of Scope

- **Subtask decomposition** — covered by Spec 2 (which depends on this spec landing first because it adds the `T<N>-<M>` ID format).
- **Git history rewrite** — old commit messages keep their `BL-N` references. History is immutable; rewriting would force-push every commit and break tags.
- **Projects beyond the three named** — only ~/redeye, ~/ControlTower, ~/haze exist today. No general migration tooling for hypothetical future projects beyond the script we ship.
- **Old changelog/CHANGELOG.md prose entries** — same reasoning as git history. They're snapshots of when written.

## ID Format

- **Tasks:** `T<N>` where N is zero-padded to a minimum of 3 digits (`T001` … `T999`), then grows naturally (`T1000`, `T1234`).
- **Subtasks (reserved for Spec 2):** `T<N>-<M>` where M is zero-padded to a minimum of 2 digits (`T034-01` … `T034-99`), then grows.
- **Counter continuity:** `next_task_id` starts at the existing `next_bl_id` value per project. ControlTower's `next_bl_id` is currently 75, so the first new task there will be `T075`. Haze's counter is preserved similarly.
- **No reuse of old BL- numbers** — every `BL-N` becomes `T<N>` with N preserved.

## Plugin Source Rename (~/redeye)

The plugin is the source of truth for agent prompts, scripts, templates. All references to backlog/BL- get rewritten in a single amend + force-push to ~/redeye's initial commit per the existing single-commit repo policy.

**File renames:**
- `templates/backlog.md.tmpl` → `templates/tasks.md.tmpl`

**Path/string substitutions inside agent prompts and scripts** (find-replace pass):
- `.redeye/backlog.md` → `.redeye/tasks.md`
- `BL-{id}` → `T{id}` (and `BL-(\d+)` → `T\1` where literal IDs appear)
- "backlog" / "Backlog" terminology → "tasks" / "Tasks" *(in conceptual references only — file paths handled above)*
- `docs/specs/BL-{id}-{slug}.md` → `docs/specs/T{id}-{slug}.md` (in `agents/plan.md`)
- State-JSON field references: `backlog_item` → `task_id`, `backlog_title` → `task_title`, `counters.next_bl_id` → `counters.next_task_id`

**Files affected** (per earlier grep):
- `agents/`: `triage.md`, `plan.md`, `cto.md`, `merge.md`, `incorporate.md`, `schedules.md`, `verify.md`, `user-tester.md`, `review.md`, `build.md`
- `scripts/`: `init-project.sh`, `digest.sh`, `start-loop.sh`
- `templates/`: `tasks.md.tmpl` (post-rename), `state.json.tmpl`, `reference.md.tmpl`, `tester-reports.md.tmpl`, `status.md.tmpl`, `config.md.tmpl`

After the rename, ~/redeye's `git push --force` lands the change to `origin/main`. ControlTower's plugin install is a symlink to ~/redeye, so the new prompts are live for the next agent spawn — no reinstall.

## State.json Schema Changes

```diff
 {
   "iteration": 95,
   "phase": "TRIAGE",
-  "backlog_item": "BL-074",
+  "task_id": "T074",
-  "backlog_title": "card height fix",
+  "task_title": "card height fix",
   "spec_file": "docs/specs/T074-card-height-fix.md",
   "counters": {
-    "next_bl_id": 75,
+    "next_task_id": 75,
     "next_q_id": 12
   },
   "item_costs": {
-    "BL-001": 0.42,
-    "BL-073": 1.18
+    "T001": 0.42,
+    "T073": 1.18
   },
   "item_cost_starts": { ... same key migration ... },
-  "worktree_branch": "redeye/BL-013"
+  "worktree_branch": "redeye/T013"
 }
```

ControlTower's `RedEyeState` interface (`lib/redeye-types.ts`) changes in lockstep, plus the JSDoc comment on `item_costs` ("keyed by BL-xxx" → "keyed by T<N>").

## ControlTower Codebase Rename

Mechanical, but spans many files. Execute in distinct passes per file type so each commit is reviewable.

### Pass 1: lib/

| Old | New |
|---|---|
| `lib/backlog-id.ts` (and `.test.ts`) | `lib/task-id.ts` (and `.test.ts`) |
| function `getNextBacklogId` | `getNextTaskId` |
| type `BacklogItem` (in `redeye-types.ts`) | `TaskItem` |
| function `parseBacklog` (in `redeye-parsers.ts`) | `parseTasks` |
| function `readBacklog` (in `redeye-files.ts`) | `readTasks` |
| `safeRedeyePath(project.path, "backlog.md")` everywhere | `safeRedeyePath(project.path, "tasks.md")` |
| `BL_ID_RE = /^BL-\d+$/i` constants | `TASK_ID_RE = /^T\d+$/` |
| State field reads: `state.backlog_item` | `state.task_id` |

Affected files (non-exhaustive): `lib/redeye-files.ts`, `lib/redeye-parsers.ts`, `lib/redeye-types.ts`, `lib/backlog-id.ts`, `lib/use-task-transition-tracker.ts`, `lib/use-keyboard-shortcuts.ts`, `lib/use-phase-notifications.ts`, `lib/use-phase-change-notifier.ts`, `lib/markdown-sanitize.ts`, `lib/redeye-files.test.ts`, `lib/git-commit-push.ts`, all corresponding `.test.ts` files.

### Pass 2: components/

| Old | New |
|---|---|
| `components/backlog-id.tsx` (and test) | `components/task-id.tsx` |
| `components/add-backlog-dialog.tsx` | `components/add-task-dialog.tsx` |
| `components/backlog-summary-section.tsx` | `components/task-summary-section.tsx` |
| Component name `BacklogSection` (inline in page) | `TaskSection` |
| Component name `BacklogId` | `TaskId` |
| Component name `AddBacklogDialog` | `AddTaskDialog` |
| Component name `BacklogSummarySection` | `TaskSummarySection` |
| Section labels in `components/section-header.tsx` and `components/project-nav.tsx` | "Tasks" |

### Pass 3: app/api/ routes

| Old route | New route |
|---|---|
| `app/api/projects/[id]/backlog/route.ts` | `app/api/projects/[id]/tasks/route.ts` |
| `app/api/projects/[id]/backlog/[taskId]/route.ts` | `app/api/projects/[id]/tasks/[taskId]/route.ts` |
| Param name `taskId` (already a generic name) | unchanged — already correct |
| Cost routes: `cost-snapshot/route.ts`, `cost-start/route.ts` body field `blId` | `taskId` (the param matches the URL convention) |

The dialog component `components/add-task-dialog.tsx` (renamed) updates its `fetch('/api/projects/${id}/backlog', …)` call to the new route. Same for any client-side fetch to backlog endpoints.

### Pass 4: app/project/ pages

| Old page | New page |
|---|---|
| `app/project/[id]/backlog/page.tsx` | `app/project/[id]/tasks/page.tsx` |
| `app/project/[id]/backlog/[taskId]/page.tsx` | `app/project/[id]/tasks/[taskId]/page.tsx` |

Update `Link href` references in `components/project-nav.tsx`, `components/working-on-card.tsx`, `app/project/[id]/page.tsx`, etc.

### Pass 5: e2e/ tests

`e2e/mobile-responsive.spec.ts` and any other Playwright spec referencing `/backlog` URLs or "Backlog" labels — update.

### Pass 6: steering.md update

`~/ControlTower/.redeye/steering.md` directives that reference `BacklogItem`, `parseBacklog`, etc. get updated to the new identifiers. (Same commit+push helper from earlier work pushes the change.)

## UI Restructure (Tasks Tab)

The renamed page (`app/project/[id]/tasks/page.tsx`) renders top-down:

```
┌─ Currently Working On ──────────────────────┐  (existing ActiveTaskCard, unchanged)
│  T074: card height fix                      │
└─────────────────────────────────────────────┘

┌─ Backlog (12)                          [▾] ─┐  (open by default)
│  T075: Add foo                              │
│  T077: Refactor bar                         │
│  T080: ...                                  │
└─────────────────────────────────────────────┘

┌─ Done (61)                             [▸] ─┐  (collapsed)
└─────────────────────────────────────────────┘

┌─ Won't Do (3)                          [▸] ─┐  (collapsed)
└─────────────────────────────────────────────┘
```

**Backlog subsection** uses the existing `CollapsibleSection` component (defaultOpen=true). Contents: every task whose `section !== "wontdo"` AND `status !== "done"` AND `id !== state.task_id`, sorted by:

1. Priority ascending: `P0` → `P1` → `P2` → unset
2. Within same priority: ID descending (newest first)

Three legacy section labels (`CEO Requests`, `Discovered`, `Triaged`) are dropped from the UI but retained in `tasks.md` because the agents use them as workflow lifecycle state.

**Done and Won't Do** stay collapsed by default, no behavior change.

**Project-level nav label** in `components/project-nav.tsx`: "Backlog" → "Tasks".

The `BacklogSection` component (renamed `TaskSection`) now takes the consolidated list directly; remove the previous per-section iteration in the page that produced three separate cards.

## Migration Script

Lives at `~/redeye/scripts/migrate-bl-to-t.sh` so it ships with the plugin and is documented in source.

```bash
#!/usr/bin/env bash
# Idempotent migration: rename .redeye/backlog.md → tasks.md and rewrite
# every BL-<N> reference to T<N> in tracking files and spec content.
# Usage: migrate-bl-to-t.sh <project_path>
set -euo pipefail

PROJECT="${1:?usage: migrate-bl-to-t.sh <project_path>}"
cd "$PROJECT"

# 1. Idempotency check
if [ -f .redeye/tasks.md ] && [ ! -f .redeye/backlog.md ]; then
  echo "Already migrated."; exit 0
fi

# 2. Rename the file
git mv .redeye/backlog.md .redeye/tasks.md

# 3. Rewrite BL-<N> in tasks.md (word-boundary anchored to avoid 'BLue' etc.)
sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' .redeye/tasks.md

# 4. Rename spec files and rewrite their content
for f in docs/specs/BL-*.md; do
  [ -f "$f" ] || continue
  new="${f/BL-/T}"
  git mv "$f" "$new"
  sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' "$new"
done

# 4b. Rewrite BL-<N> references inside other doc trees that reference items
# (decisions, briefs, archived backlog/specs). Filenames in these dirs aren't
# expected to contain BL- prefixes; only content needs rewriting.
for dir in docs/decisions docs/briefs docs/backlog-archive docs/specs-archive; do
  [ -d "$dir" ] || continue
  find "$dir" -type f -name '*.md' -exec sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' {} +
done

# 5. Rewrite state.json: rename keys and rewrite map keys via jq
jq '
  (.backlog_item // empty) as $bi
  | (.backlog_title // empty) as $bt
  | (.counters.next_bl_id // empty) as $nbl
  | del(.backlog_item, .backlog_title, .counters.next_bl_id)
  | (if $bi  then .task_id = ($bi | gsub("BL-(?<n>[0-9]+)"; "T\(.n)")) else . end)
  | (if $bt  then .task_title = $bt else . end)
  | (if $nbl then .counters.next_task_id = $nbl else . end)
  | (if .item_costs then .item_costs |= with_entries(.key |= gsub("BL-(?<n>[0-9]+)"; "T\(.n)")) else . end)
  | (if .item_cost_starts then .item_cost_starts |= with_entries(.key |= gsub("BL-(?<n>[0-9]+)"; "T\(.n)")) else . end)
  | (if .worktree_branch then .worktree_branch |= gsub("BL-(?<n>[0-9]+)"; "T\(.n)") else . end)
  | (if .worktree_path   then .worktree_path   |= gsub("BL-(?<n>[0-9]+)"; "T\(.n)") else . end)
' .redeye/state.json > .redeye/state.json.tmp && mv .redeye/state.json.tmp .redeye/state.json

# 6. Rewrite remaining tracking files
for f in .redeye/inbox.md .redeye/changelog.md .redeye/tester-reports.md .redeye/steering.md .redeye/feedback.md; do
  [ -f "$f" ] && sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' "$f"
done

# 7. Stage everything and print a diff for operator review
git add -A
echo "--- Migration complete. Review with: git diff --cached"
```

**Operator workflow per project:**

1. Stop the running CTO loop (graceful via `/api/projects/<i>/stop` or hard via `/force-stop`) so it doesn't race the migration.
2. `bash ~/redeye/scripts/migrate-bl-to-t.sh ~/ControlTower`
3. Review `git diff --cached`, confirm no surprises.
4. `git commit -m "chore: migrate BL- → T- task IDs"`
5. `git push`
6. Restart the CTO loop. First TRIAGE iteration uses the new prompt + new `tasks.md`.

Repeat for `~/haze`.

## Cross-Repo Coordination

Order of operations matters because TRIAGE syncs from origin/main:

1. **First**: ControlTower codebase rename (~50 files, multiple passes per the plan above). Push to origin.
2. **Second**: ~/redeye plugin source rename (single amend + force-push).
3. **Third**: Run migration script on ControlTower, push.
4. **Fourth**: Run migration script on haze, push.

The window between steps 2 and 3 is risky — RedEye CTO will read the new prompt (referencing `tasks.md`) but the project file is still `backlog.md`. Mitigation: stop CTO before step 2, only restart after step 3 completes for whichever project is being worked on.

## Testing

### ControlTower

- **Bulk find-replace**: every test file gets `BL-` → `T`, `Backlog` → `Tasks`, `parseBacklog` → `parseTasks`, etc. Use `git grep` after each rename pass to find leftovers.
- **Add a regression test** in `lib/redeye-parsers.test.ts`: `parseTasks` correctly parses a `tasks.md` containing `### T075: foo`. Mirror existing `parseBacklog` test structure.
- **Run `npx vitest run` after every commit pass** — expect ~50 test files to update; bisect any unexpected failures by pass.
- **Type check**: `npx tsc --noEmit` after Pass 1 (lib renames) — type union changes will surface here first.

### Plugin source

- **No automated tests in ~/redeye** (it's prompts + scripts, not code).
- **Manual smoke**: after ~/redeye amend + push and ControlTower migration, restart CTO on ControlTower, watch first TRIAGE iteration confirm it reads `.redeye/tasks.md` and references `T<N>` IDs in its commit message.

### Migration script

- **Test on haze first** (smaller, lower stakes). `git stash` any uncommitted changes there; run script; review diff; if good, commit. If bad, `git checkout -- .redeye docs/specs && git stash pop`.
- **Then ControlTower**.

### Manual smoke (in browser)

- Open Tasks tab → confirm Backlog/Done/Won't Do render, all IDs are `T<N>`.
- Add a new task via the dialog → it gets the next `T<N>` and lands in Backlog.
- Click into a task → detail page renders, edit/delete work.
- Trigger Stop/Pause from working-on-card → directive lands in steering.md, no `BL-` anywhere.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Regex `BL-(\d+)` matches `BL-` substring inside legitimate prose like "BLue-1 widget" or "table-1 BL-2 lookup" | Anchor with word boundaries: `\bBL-(\d+)\b`. Used throughout the script. |
| RedEye CTO reads the new prompt but the project file is still `backlog.md` (window between plugin push and migration) | Stop CTO before plugin push; only restart after the project's migration is complete and pushed. |
| Tests break en masse and we can't separate mechanical breakages from real ones | Distinct commit per pass (lib, components, routes, pages). Each commit independently runnable; any pass that doesn't go green is rolled back without affecting earlier ones. |
| Mixed-namespace state — some `BL-N` reference left somewhere we missed | Final grep gate before declaring done: `git grep -E '\bBL-\d+\b' -- ':(exclude).git' ':(exclude)node_modules' ':(exclude).next'` must return zero hits in both repos and both managed projects. |
| Migration script's jq runs on a malformed state.json and silently corrupts it | Idempotency check in step 1; backup via `cp .redeye/state.json .redeye/state.json.bak` before jq runs; if jq exits non-zero, restore from backup. |
| Worktree branches in flight at migration time still reference `redeye/BL-N` | Migration script rewrites the `worktree_branch` and `worktree_path` fields in state.json. The actual git branch name isn't renamed (would require coordinating with active CTO process); on the next worktree teardown the branch is deleted naturally and the next plan creates `redeye/T<N>` instead. Acceptable transient state. |
| Migration script uses BSD `sed -i ''` syntax — won't work on Linux | Add a runtime check at script start: `if sed --version >/dev/null 2>&1; then SED_INPLACE='-i'; else SED_INPLACE=("-i" "''"); fi` OR document the macOS-only constraint in the script header. Today all three projects live on the same macOS dev box, so this is a future-portability note rather than a current bug. |

## Definition of Done

- [ ] ~/redeye amended + force-pushed; HEAD references `tasks.md`, `T<N>`, etc.
- [ ] ControlTower codebase rename complete across 6 passes; full vitest suite green.
- [ ] Migration script ships in ~/redeye/scripts/, idempotent.
- [ ] ControlTower migrated; `git grep -E '\bBL-\d+\b'` returns zero hits in tracking files.
- [ ] Haze migrated; same grep returns zero hits.
- [ ] Manual browser smoke test of Tasks tab passes (add/edit/delete/Stop/Pause flows).
- [ ] First TRIAGE iteration after migration completes successfully and uses `T<N>` IDs in its commit messages.
- [ ] CONTRIBUTING.md / README.md (if they reference "backlog" or "BL-") updated.
- [ ] Spec 2 (subtask decomposition) can begin — the T- namespace is established.
