# Backlog → Tasks Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Backlog / BL-N" → "Tasks / T<N>" across the RedEye plugin (~/redeye), the ControlTower codebase (~/ControlTower), and three managed projects (~/ControlTower, ~/haze, ~/redeye), and restructure ControlTower's Tasks tab so non-active items live in a flat collapsible Backlog subsection.

**Architecture:** Mostly mechanical: file renames, sed-style identifier rewrites, route URL changes. The risky parts are (a) the brittle window between renames where the running CTO and ControlTower codebase disagree on the file name, and (b) managing a single coherent ID scheme across three repos that don't share a build. Mitigation: stop all CTO loops up front, work in five sequential phases each with tests + grep gates, only restart when every phase is green.

**Tech Stack:** Next.js 16 App Router, Vitest, TypeScript, Bash + jq + sed (BSD/macOS), git.

**Scope:** This plan covers Spec 1 only (rename + UI restructure). Subtask decomposition is Spec 2 — separate plan once this ships.

**Spec:** `~/ControlTower/docs/superpowers/specs/2026-04-26-tasks-rename-design.md`

---

## File Structure Reference

**New files (~/redeye):**
- `scripts/migrate-bl-to-t.sh` — idempotent per-project migration script

**Renamed files (~/redeye):**
- `templates/backlog.md.tmpl` → `templates/tasks.md.tmpl`

**Modified files (~/redeye, content):**
- `agents/{cto,triage,plan,build,review,verify,merge,deploy,incorporate,schedules,user-tester}.md` — all references to `.redeye/backlog.md`, `BL-{id}`, `docs/specs/BL-`, "backlog"/"Backlog"
- `scripts/{init-project.sh,digest.sh,start-loop.sh}`
- `templates/{state.json,reference,tester-reports,status,config}.md.tmpl` (and the renamed tasks.md.tmpl)

**Renamed files (~/ControlTower):**
- `lib/backlog-id.ts` (+ `.test.ts`) → `lib/task-id.ts`
- `components/backlog-id.tsx` (+ `.test.tsx` if exists) → `components/task-id.tsx`
- `components/add-backlog-dialog.tsx` → `components/add-task-dialog.tsx`
- `components/backlog-summary-section.tsx` (+ `.test.tsx`) → `components/task-summary-section.tsx`
- `app/api/projects/[id]/backlog/route.ts` (+ `.test.ts`) → `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/[id]/backlog/[taskId]/route.ts` (+ `.test.ts`) → `app/api/projects/[id]/tasks/[taskId]/route.ts`
- `app/project/[id]/backlog/page.tsx` (+ `.test.tsx`) → `app/project/[id]/tasks/page.tsx`
- `app/project/[id]/backlog/[taskId]/page.tsx` (+ `.test.tsx`) → `app/project/[id]/tasks/[taskId]/page.tsx`

**Modified files (~/ControlTower, content):**
- `lib/redeye-types.ts` — `BacklogItem` → `TaskItem`, `RedEyeState.backlog_item` → `task_id`, `backlog_title` → `task_title`, `counters.next_bl_id` → `counters.next_task_id`, JSDoc updates
- `lib/redeye-parsers.ts` — `parseBacklog` → `parseTasks`
- `lib/redeye-files.ts` — `readBacklog` → `readTasks`, all `safeRedeyePath(p, "backlog.md")` → `"tasks.md"`
- `lib/markdown-sanitize.ts` — comments referencing backlog
- `lib/use-task-transition-tracker.ts`, `lib/use-keyboard-shortcuts.ts`, `lib/use-phase-notifications.ts`, `lib/use-phase-change-notifier.ts` — type imports + identifier names
- `lib/git-commit-push.ts` — comment about backlog.md
- `components/section-header.tsx`, `components/project-nav.tsx`, `components/onboarding-wizard.tsx`, `components/phase-badge.tsx`, `components/project-card.tsx` — UI labels and type imports
- `app/api/projects/[id]/cost-snapshot/route.ts`, `app/api/projects/[id]/cost-start/route.ts` — `BL_ID_RE` → `TASK_ID_RE`
- `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/answer/route.ts` — type imports + state field reads
- `app/page.tsx`, `app/project/[id]/page.tsx`, `app/project/[id]/live/page.tsx`, `app/project/[id]/schedules/page.tsx`, `app/project/[id]/steer/page.tsx` — link hrefs, type imports
- `e2e/mobile-responsive.spec.ts` — URL paths and labels
- `~/ControlTower/.redeye/steering.md` — updated identifier names in directives

**Migrated files (per managed project — by script):**
- `.redeye/backlog.md` → `.redeye/tasks.md` (rename + content rewrite)
- `.redeye/state.json` (key + value rewrites)
- `.redeye/inbox.md`, `.redeye/changelog.md`, `.redeye/tester-reports.md`, `.redeye/steering.md`, `.redeye/feedback.md` (content rewrites)
- `docs/specs/BL-*.md` → `docs/specs/T*.md` (rename + content rewrite)
- `docs/decisions/*.md`, `docs/briefs/*.md`, `docs/backlog-archive/*.md`, `docs/specs-archive/*.md` (content rewrites)

---

## Phase 0: Migration Script

The script must be ready and tested before we touch any project file, so we can run it the moment the codebase rename is committed.

### Task 0.1: Write the migration script

**Files:**
- Create: `~/redeye/scripts/migrate-bl-to-t.sh`

- [ ] **Step 1: Create the script with full content**

```bash
cat > ~/redeye/scripts/migrate-bl-to-t.sh <<'EOF'
#!/usr/bin/env bash
# Idempotent migration: rename .redeye/backlog.md → tasks.md and rewrite
# every BL-<N> reference to T<N> in tracking files and spec content.
# Usage: migrate-bl-to-t.sh <project_path>
#
# NOTE: uses BSD sed (`sed -i ''`). macOS only as written.
set -euo pipefail

PROJECT="${1:?usage: migrate-bl-to-t.sh <project_path>}"
cd "$PROJECT"

# 1. Idempotency check
if [ -f .redeye/tasks.md ] && [ ! -f .redeye/backlog.md ]; then
  echo "Already migrated."; exit 0
fi
if [ ! -f .redeye/backlog.md ]; then
  echo "No .redeye/backlog.md found at $PROJECT — not a RedEye project?" >&2
  exit 1
fi

# 2. Backup state.json before jq touches it
cp .redeye/state.json .redeye/state.json.bak

# 3. Rename the file
git mv .redeye/backlog.md .redeye/tasks.md

# 4. Rewrite BL-<N> in tasks.md (word-boundary anchored)
sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' .redeye/tasks.md

# 5. Rename spec files and rewrite their content
for f in docs/specs/BL-*.md; do
  [ -f "$f" ] || continue
  new="${f/BL-/T}"
  git mv "$f" "$new"
  sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' "$new"
done

# 5b. Rewrite BL-<N> references inside other doc trees (filenames don't change)
for dir in docs/decisions docs/briefs docs/backlog-archive docs/specs-archive; do
  [ -d "$dir" ] || continue
  find "$dir" -type f -name '*.md' -exec sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' {} +
done

# 6. Rewrite state.json: rename keys and rewrite map keys via jq
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
' .redeye/state.json > .redeye/state.json.tmp

if [ ! -s .redeye/state.json.tmp ]; then
  echo "jq produced empty output — restoring backup" >&2
  rm -f .redeye/state.json.tmp
  cp .redeye/state.json.bak .redeye/state.json
  exit 1
fi
mv .redeye/state.json.tmp .redeye/state.json

# 7. Rewrite remaining tracking files
for f in .redeye/inbox.md .redeye/changelog.md .redeye/tester-reports.md .redeye/steering.md .redeye/feedback.md; do
  [ -f "$f" ] && sed -i '' -E 's/\bBL-([0-9]+)\b/T\1/g' "$f"
done

# 8. Stage everything for review
git add -A
echo "--- Migration complete. Review: git diff --cached ---"
echo "Backup of original state.json at .redeye/state.json.bak (delete after review)."
EOF
chmod +x ~/redeye/scripts/migrate-bl-to-t.sh
```

- [ ] **Step 2: Verify it parses without syntax errors**

Run: `bash -n ~/redeye/scripts/migrate-bl-to-t.sh`
Expected: exit 0, no output.

- [ ] **Step 3: Verify jq is installed (macOS)**

Run: `command -v jq && jq --version`
Expected: `/opt/homebrew/bin/jq` (or similar) and a version string. If missing: `brew install jq`.

- [ ] **Step 4: Hold off committing**

The script is part of the ~/redeye amend in Phase 2, not a standalone commit (~/redeye uses single-commit policy). Leave it in the working tree for now.

### Task 0.2: Test the script on a throwaway copy of haze

**Files:**
- Read: `~/haze/.redeye/backlog.md`, `~/haze/.redeye/state.json`
- Test: a temp dir that's a snapshot of `~/haze`

- [ ] **Step 1: Create a throwaway copy of haze**

```bash
TESTDIR=$(mktemp -d)
cp -R ~/haze/. "$TESTDIR/"
cd "$TESTDIR"
git status --short | head -5
```
Expected: clean working tree (or near-clean — the copy preserves git state).

- [ ] **Step 2: Run the migration script on the copy**

```bash
bash ~/redeye/scripts/migrate-bl-to-t.sh "$TESTDIR"
```
Expected: prints `--- Migration complete. Review: git diff --cached ---` with no errors.

- [ ] **Step 3: Verify the migration**

```bash
cd "$TESTDIR"
[ -f .redeye/tasks.md ] && echo "✓ tasks.md exists"
[ ! -f .redeye/backlog.md ] && echo "✓ backlog.md gone"
grep -E '^### T[0-9]+' .redeye/tasks.md | head -3
git grep -E '\bBL-[0-9]+\b' -- ':!*.bak' | head -5
```
Expected:
- `✓ tasks.md exists`
- `✓ backlog.md gone`
- A few `### T001`, `### T002` lines
- The `git grep` returns ZERO hits for `BL-N` (or only hits in `.bak` files)

- [ ] **Step 4: Verify state.json round-trip**

```bash
cd "$TESTDIR"
jq '.task_id, .task_title, .counters.next_task_id, (.item_costs // {} | keys | .[0:3])' .redeye/state.json
jq '.backlog_item, .backlog_title, .counters.next_bl_id' .redeye/state.json
```
Expected:
- First command: shows the new keys with `T<N>` values
- Second command: prints `null\nnull\nnull` (old keys are gone)

- [ ] **Step 5: Test idempotency — run again**

```bash
bash ~/redeye/scripts/migrate-bl-to-t.sh "$TESTDIR"
```
Expected: prints `Already migrated.` and exits 0 cleanly.

- [ ] **Step 6: Cleanup the test directory**

```bash
rm -rf "$TESTDIR"
```

- [ ] **Step 7: If anything failed, fix the script and re-test from Step 1**

The script is the gating artifact — if it doesn't work cleanly here, do not proceed to Phase 1.

---

## Phase 1: ControlTower Codebase Rename

Six passes over `~/ControlTower`. Each pass = one commit. Vitest runs after every pass; tsc runs after Pass 1 (because that's where types change). All passes precede project-file migration, so the dev server will be broken between Phase 1 and Phase 3 — that's expected.

### Task 1.0: Stop CTO loops on all three projects

The CTO process reads `state.backlog_item` from disk every iteration. Renaming files mid-run would corrupt state. Stop everything before any rename.

- [ ] **Step 1: Stop the CTO on each project via the API**

```bash
for project_id in 0 1 2; do
  curl -s -X POST \
    -H 'Origin: http://127.0.0.1:3200' \
    -H 'Sec-Fetch-Site: same-origin' \
    -H 'Content-Type: application/json' \
    "http://127.0.0.1:3200/api/projects/$project_id/force-stop"
  echo
done
```
Expected: each call returns `{"data":{"success":true,...}}`.

- [ ] **Step 2: Verify all three CTOs are stopped**

```bash
curl -s -H 'Origin: http://127.0.0.1:3200' http://127.0.0.1:3200/api/projects \
  | python3 -c 'import json,sys; [print(p["name"], p["sessionStatus"]["cto"]["status"]) for p in json.load(sys.stdin)["data"]]'
```
Expected: `haze stopped`, `ControlTower stopped`, `redeye stopped`.

- [ ] **Step 3: Confirm green test baseline before any rename**

```bash
cd ~/ControlTower && npx vitest run --reporter=dot 2>&1 | tail -3
```
Expected: `Tests <N> passed (<N>)` with N matching the current count (~691). Do not proceed if any test is red.

### Task 1.1: Pass 1 — Rename `lib/`

**Files (modify):**
- `lib/redeye-types.ts` — `BacklogItem` → `TaskItem`, `RedEyeState.backlog_item` → `task_id`, etc.
- `lib/redeye-parsers.ts` — `parseBacklog` → `parseTasks`
- `lib/redeye-files.ts` — `readBacklog` → `readTasks`, `safeRedeyePath(_, "backlog.md")` → `"tasks.md"`
- `lib/markdown-sanitize.ts` (comment cleanup)
- `lib/use-task-transition-tracker.ts`, `lib/use-keyboard-shortcuts.ts`, `lib/use-phase-notifications.ts`, `lib/use-phase-change-notifier.ts` (identifier renames)
- `lib/git-commit-push.ts` (comment about `.redeye/backlog.md`)

**Files (rename):**
- `lib/backlog-id.ts` → `lib/task-id.ts` (and `.test.ts`)

- [ ] **Step 1: Update the type union in redeye-types.ts**

Edit `lib/redeye-types.ts`:

```typescript
// Replace the BacklogItem interface name with TaskItem
export interface TaskItem {
  id: string;
  title: string;
  type?: string;
  priority?: string;
  status: "pending" | "planned" | "in-progress" | "done" | "blocked" | "pending-triage" | "wontdo";
  section: "ceo" | "discovered" | "triaged" | "wontdo";
  details?: string;
  spec?: string;
  /** Estimated cost in USD for this item. Set at completion time via cost-snapshot API. */
  cost_usd?: number;
  /** Single-line LLM-authored summary of what shipped. Written by CTO at VERIFY time. */
  summary?: string;
  /** Rationale text from `**Reason:**` field — typically present on wont-do items. */
  reason?: string;
}

// In the RedEyeState interface, rename three fields:
//   backlog_item → task_id
//   backlog_title → task_title
//   counters.next_bl_id → counters.next_task_id
// Update the JSDoc on item_costs/item_cost_starts:
//   "keyed by BL-xxx" → "keyed by T<N>"

// In ProjectDetail, rename:
//   activeItem: BacklogItem | null  →  activeItem: TaskItem | null
//   upNext: BacklogItem[]  →  upNext: TaskItem[]
//   recentlyShipped: BacklogItem[]  →  recentlyShipped: TaskItem[]
//   wontDoItems: BacklogItem[]  →  wontDoItems: TaskItem[]
```

Use sed to do the bulk rename safely:
```bash
cd ~/ControlTower
sed -i '' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  -e 's/\bbacklog_title\b/task_title/g' \
  -e 's/\bnext_bl_id\b/next_task_id/g' \
  -e 's|keyed by BL-xxx|keyed by T<N>|g' \
  lib/redeye-types.ts
```

- [ ] **Step 2: Verify the type file compiles**

```bash
cd ~/ControlTower && npx tsc --noEmit lib/redeye-types.ts 2>&1 | head -10
```
Expected: no errors specific to `lib/redeye-types.ts` (errors elsewhere are expected — they're consumers we'll update next).

- [ ] **Step 3: Bulk-rename across all of lib/**

```bash
cd ~/ControlTower
find lib -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'backlog-id.*' -exec sed -i '' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  -e 's/\bbacklog_title\b/task_title/g' \
  -e 's/\bnext_bl_id\b/next_task_id/g' \
  -e 's/\bparseBacklog\b/parseTasks/g' \
  -e 's/\breadBacklog\b/readTasks/g' \
  -e 's|safeRedeyePath(\([^,]*\),\s*"backlog\.md")|safeRedeyePath(\1, "tasks.md")|g' \
  {} +
```

- [ ] **Step 4: Rename `lib/backlog-id.ts` and update its function name**

```bash
cd ~/ControlTower
git mv lib/backlog-id.ts lib/task-id.ts
git mv lib/backlog-id.test.ts lib/task-id.test.ts
sed -i '' \
  -e 's/\bgetNextBacklogId\b/getNextTaskId/g' \
  -e 's/\bnext_bl_id\b/next_task_id/g' \
  -e 's|@/lib/backlog-id|@/lib/task-id|g' \
  lib/task-id.ts lib/task-id.test.ts
```

- [ ] **Step 5: Update all import paths across lib/ and elsewhere that reference backlog-id**

```bash
cd ~/ControlTower
grep -rl '@/lib/backlog-id' --include='*.ts' --include='*.tsx' | while read f; do
  sed -i '' 's|@/lib/backlog-id|@/lib/task-id|g' "$f"
  sed -i '' 's/\bgetNextBacklogId\b/getNextTaskId/g' "$f"
done
```

- [ ] **Step 6: Run vitest on lib/ tests only**

```bash
cd ~/ControlTower && npx vitest run lib/ --reporter=dot 2>&1 | tail -10
```
Expected: all lib tests pass (count varies). If failures: read the error, the most likely cause is a missed identifier in a test file. Fix and re-run.

- [ ] **Step 7: Run typecheck**

```bash
cd ~/ControlTower && npx tsc --noEmit 2>&1 | grep -vE '\.test\.ts.*Mock' | head -20
```
Expected: no errors except the pre-existing vitest Mock typing noise in `stream-utils.test.ts` and `session-manager.test.ts`. Errors mentioning `BacklogItem`, `parseBacklog`, etc. mean a consumer outside lib/ wasn't updated yet — fix in Pass 2/3/4 as appropriate. Errors in non-test source files are blockers.

- [ ] **Step 8: Verify zero `Backlog`-named identifiers remain in lib/**

```bash
cd ~/ControlTower
grep -rE '\b(BacklogItem|parseBacklog|readBacklog|getNextBacklogId|backlog_item|backlog_title|next_bl_id)\b' lib/ | head
```
Expected: zero output.

- [ ] **Step 9: Commit Pass 1**

```bash
cd ~/ControlTower
git add lib/
git commit -m "refactor: rename Backlog → Tasks in lib/ (pass 1/6)

BacklogItem → TaskItem
parseBacklog → parseTasks
readBacklog → readTasks
getNextBacklogId → getNextTaskId
state.backlog_item → state.task_id
state.backlog_title → state.task_title
counters.next_bl_id → counters.next_task_id
safeRedeyePath(_, 'backlog.md') → 'tasks.md'

File rename: lib/backlog-id.ts → lib/task-id.ts.

Part 1 of the Spec 1 (Backlog → Tasks rename + UI restructure)
codebase rename. Subsequent passes update components/, app/api/,
app/project/, e2e/, and steering.md respectively.

See: docs/superpowers/specs/2026-04-26-tasks-rename-design.md"
```

### Task 1.2: Pass 2 — Rename `components/`

**Files (rename):**
- `components/backlog-id.tsx` → `components/task-id.tsx`
- `components/add-backlog-dialog.tsx` → `components/add-task-dialog.tsx`
- `components/backlog-summary-section.tsx` (+ `.test.tsx`) → `components/task-summary-section.tsx`

**Files (modify):**
- All other `components/*.tsx` that import or reference backlog identifiers

- [ ] **Step 1: Rename the three component files (plus tests)**

```bash
cd ~/ControlTower
git mv components/backlog-id.tsx components/task-id.tsx
git mv components/add-backlog-dialog.tsx components/add-task-dialog.tsx
git mv components/backlog-summary-section.tsx components/task-summary-section.tsx
git mv components/backlog-summary-section.test.tsx components/task-summary-section.test.tsx
```

- [ ] **Step 2: Rename component identifiers and props**

```bash
cd ~/ControlTower
find components -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' \
  -e 's/\bBacklogId\b/TaskId/g' \
  -e 's/\bAddBacklogDialog\b/AddTaskDialog/g' \
  -e 's/\bBacklogSection\b/TaskSection/g' \
  -e 's/\bBacklogSummarySection\b/TaskSummarySection/g' \
  -e 's|@/components/backlog-id|@/components/task-id|g' \
  -e 's|@/components/add-backlog-dialog|@/components/add-task-dialog|g' \
  -e 's|@/components/backlog-summary-section|@/components/task-summary-section|g' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  {} +
```

- [ ] **Step 3: Update the project nav label**

Edit `components/project-nav.tsx`. Find the entry for the Backlog tab (likely a `{ label: "Backlog", href: ... }` object) and change `"Backlog"` → `"Tasks"`. The `href` is updated in Pass 4 (page rename).

```bash
cd ~/ControlTower && grep -n '"Backlog"' components/project-nav.tsx
```
Replace each match by editing the file directly (don't blanket-sed `Backlog` to `Tasks` — there's no other current use, but a manual edit avoids future surprises).

- [ ] **Step 4: Run vitest on components/**

```bash
cd ~/ControlTower && npx vitest run components/ --reporter=dot 2>&1 | tail -10
```
Expected: all component tests pass.

- [ ] **Step 5: Verify zero `Backlog`-named identifiers remain in components/**

```bash
cd ~/ControlTower
grep -rE '\b(BacklogId|AddBacklogDialog|BacklogSection|BacklogSummarySection|BacklogItem|backlog_item)\b' components/ | head
```
Expected: zero output.

- [ ] **Step 6: Commit Pass 2**

```bash
cd ~/ControlTower
git add components/
git commit -m "refactor: rename Backlog → Tasks in components/ (pass 2/6)

File renames:
- components/backlog-id.tsx → task-id.tsx
- components/add-backlog-dialog.tsx → add-task-dialog.tsx
- components/backlog-summary-section.tsx → task-summary-section.tsx

Identifier renames mirror lib/ pass: BacklogId → TaskId,
AddBacklogDialog → AddTaskDialog, BacklogSection → TaskSection,
BacklogSummarySection → TaskSummarySection. Project-nav label
'Backlog' → 'Tasks'.

Part 2 of the Spec 1 codebase rename."
```

### Task 1.3: Pass 3 — Rename `app/api/` routes

**Files (rename — directories):**
- `app/api/projects/[id]/backlog/route.ts` (+ `.test.ts`) → `app/api/projects/[id]/tasks/route.ts`
- `app/api/projects/[id]/backlog/[taskId]/route.ts` (+ `.test.ts`) → `app/api/projects/[id]/tasks/[taskId]/route.ts`

**Files (modify):**
- `app/api/projects/[id]/cost-snapshot/route.ts`, `app/api/projects/[id]/cost-start/route.ts` — `BL_ID_RE` → `TASK_ID_RE`, `blId` → `taskId`
- `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/answer/route.ts` — type imports + state field reads

- [ ] **Step 1: Move route directories**

```bash
cd ~/ControlTower
git mv "app/api/projects/[id]/backlog" "app/api/projects/[id]/tasks"
```

- [ ] **Step 2: Rewrite cost-snapshot and cost-start to use `taskId`**

```bash
cd ~/ControlTower
sed -i '' \
  -e 's/\bBL_ID_RE\b/TASK_ID_RE/g' \
  -e 's|/\^BL-\\d+\$/i|/^T\\d+\$/|g' \
  -e 's/\bblId\b/taskId/g' \
  "app/api/projects/[id]/cost-snapshot/route.ts" \
  "app/api/projects/[id]/cost-start/route.ts" \
  "app/api/projects/[id]/cost-snapshot/route.test.ts" \
  "app/api/projects/[id]/cost-start/route.test.ts"
```

- [ ] **Step 3: Update type imports and state field reads in remaining api routes**

```bash
cd ~/ControlTower
find "app/api" -type f \( -name '*.ts' \) -exec sed -i '' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  -e 's/\bbacklog_title\b/task_title/g' \
  -e 's/\bnext_bl_id\b/next_task_id/g' \
  -e 's/\bparseBacklog\b/parseTasks/g' \
  -e 's/\breadBacklog\b/readTasks/g' \
  -e 's/\bgetNextBacklogId\b/getNextTaskId/g' \
  -e 's|@/lib/backlog-id|@/lib/task-id|g' \
  -e 's|@/components/backlog-id|@/components/task-id|g' \
  -e 's|@/components/add-backlog-dialog|@/components/add-task-dialog|g' \
  -e 's|safeRedeyePath(\([^,]*\),\s*"backlog\.md")|safeRedeyePath(\1, "tasks.md")|g' \
  {} +
```

- [ ] **Step 4: Update test files inside the renamed routes — mock paths and request URLs**

```bash
cd ~/ControlTower
find "app/api/projects/[id]/tasks" -name '*.test.ts' -exec sed -i '' \
  -e 's|/api/projects/\${id}/backlog|/api/projects/${id}/tasks|g' \
  -e 's|/api/projects/\${id}/backlog/\${taskId}|/api/projects/${id}/tasks/${taskId}|g' \
  {} +
```

- [ ] **Step 5: Run vitest on api routes**

```bash
cd ~/ControlTower && npx vitest run "app/api/" --reporter=dot 2>&1 | tail -10
```
Expected: all pass. The most common breakage class is mock paths that still reference `@/lib/backlog-id` or `@/components/backlog-id` — fix any that show up.

- [ ] **Step 6: Verify zero leftover identifiers in app/api/**

```bash
cd ~/ControlTower
grep -rE '\b(BacklogItem|parseBacklog|readBacklog|getNextBacklogId|backlog_item|backlog_title|next_bl_id|blId|BL_ID_RE)\b' "app/api/" | head
```
Expected: zero output.

- [ ] **Step 7: Commit Pass 3**

```bash
cd ~/ControlTower
git add "app/api/"
git commit -m "refactor: rename Backlog → Tasks in app/api/ routes (pass 3/6)

Directory rename:
- app/api/projects/[id]/backlog/ → app/api/projects/[id]/tasks/

Cost routes now take 'taskId' in the body and validate against
TASK_ID_RE (= /^T\\d+\$/) — no more BL_ID_RE.

Other route files updated to import TaskItem and read state.task_id.

Part 3 of the Spec 1 codebase rename."
```

### Task 1.4: Pass 4 — Rename `app/project/` pages

**Files (rename — directories):**
- `app/project/[id]/backlog/page.tsx` (+ `.test.tsx`) → `app/project/[id]/tasks/page.tsx`
- `app/project/[id]/backlog/[taskId]/page.tsx` (+ `.test.tsx`) → `app/project/[id]/tasks/[taskId]/page.tsx`

**Files (modify):**
- `app/page.tsx`, `app/project/[id]/page.tsx`, `app/project/[id]/live/page.tsx`, `app/project/[id]/schedules/page.tsx`, `app/project/[id]/steer/page.tsx` — link hrefs and type imports

- [ ] **Step 1: Move page directories**

```bash
cd ~/ControlTower
git mv "app/project/[id]/backlog" "app/project/[id]/tasks"
```

- [ ] **Step 2: Update Link hrefs and type imports across all app/project/ files**

```bash
cd ~/ControlTower
find "app/project" "app/page.tsx" -type f \( -name '*.tsx' -o -name '*.ts' \) -exec sed -i '' \
  -e 's|/project/\${id}/backlog|/project/${id}/tasks|g' \
  -e 's|/project/\${[^}]*}/backlog|&|g' \
  -e 's|/project/\${projectId}/backlog|/project/${projectId}/tasks|g' \
  -e 's|/project/\${id}/backlog/\${[^}]*}|&|g' \
  -e 's|"/backlog"|"/tasks"|g' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  -e 's/\bbacklog_title\b/task_title/g' \
  -e 's|@/components/backlog-id|@/components/task-id|g' \
  -e 's|@/components/add-backlog-dialog|@/components/add-task-dialog|g' \
  -e 's|@/components/backlog-summary-section|@/components/task-summary-section|g' \
  -e 's|@/lib/backlog-id|@/lib/task-id|g' \
  -e 's/\bBacklogId\b/TaskId/g' \
  -e 's/\bAddBacklogDialog\b/AddTaskDialog/g' \
  -e 's/\bBacklogSection\b/TaskSection/g' \
  -e 's/\bBacklogSummarySection\b/TaskSummarySection/g' \
  {} +
```

- [ ] **Step 3: Update tests inside the renamed page directories**

```bash
cd ~/ControlTower
find "app/project/[id]/tasks" -name '*.test.*' -exec sed -i '' \
  -e 's|/project/\${id}/backlog|/project/${id}/tasks|g' \
  -e 's|"/api/projects/[^"]*backlog|"/api/projects/${id}/tasks|g' \
  {} +
```

- [ ] **Step 4: Implement the UI restructure on the renamed page**

Edit `app/project/[id]/tasks/page.tsx`. The current page has separate `BacklogSection` cards for `CEO Requests`, `Discovered`, `Triaged`. Consolidate into one flat `TaskSection`:

```typescript
// Inside the page render, replace the three per-section iterations with:

const sortedBacklog = [...plannedItems].sort((a, b) => {
  const pri = (p: string | undefined) => p === "P0" ? 0 : p === "P1" ? 1 : p === "P2" ? 2 : 3;
  const dp = pri(a.priority) - pri(b.priority);
  if (dp !== 0) return dp;
  return parseTaskIdNumber(b.id) - parseTaskIdNumber(a.id); // newest first
});

// And render:
<CollapsibleSection title="Backlog" count={sortedBacklog.length} defaultOpen={true}>
  <TaskSection items={sortedBacklog} projectId={projectId} />
</CollapsibleSection>
```

The existing `parseBacklogIdNumber` (now `parseTaskIdNumber` after Pass 1's rename) handles `T<N>` correctly because the regex `/T-?(\d+)/i` would still match — but verify: the function is at the top of `app/project/[id]/tasks/page.tsx` and was originally defined as:

```typescript
export function parseBacklogIdNumber(id: string): number {
  const match = id.match(/BL-(\d+)/i);
  if (!match) return 0;
  return parseInt(match[1], 10) || 0;
}
```

Rename and update to handle T<N>:

```typescript
export function parseTaskIdNumber(id: string): number {
  const match = id.match(/T(\d+)/i);
  if (!match) return 0;
  return parseInt(match[1], 10) || 0;
}
```

Update `computeBuckets` (currently exported from same file) accordingly — change all `BacklogItem` → `TaskItem` references in its signature.

- [ ] **Step 5: Add a unit test for the new `parseTaskIdNumber`**

Add to `app/project/[id]/tasks/page.test.tsx` (or wherever existing tests live):

```typescript
import { parseTaskIdNumber, computeBuckets } from "./page";

describe("parseTaskIdNumber", () => {
  it("extracts numeric portion from T-prefixed id", () => {
    expect(parseTaskIdNumber("T001")).toBe(1);
    expect(parseTaskIdNumber("T075")).toBe(75);
    expect(parseTaskIdNumber("T1234")).toBe(1234);
  });
  it("returns 0 for malformed ids", () => {
    expect(parseTaskIdNumber("")).toBe(0);
    expect(parseTaskIdNumber("not-a-task")).toBe(0);
  });
});

describe("computeBuckets — flat backlog consolidation", () => {
  const items = [
    { id: "T077", title: "z", status: "pending", section: "ceo" },
    { id: "T075", title: "y", status: "planned", section: "triaged" },
    { id: "T076", title: "x", status: "pending", section: "discovered" },
    { id: "T070", title: "done", status: "done", section: "triaged" },
    { id: "T060", title: "skip", status: "wontdo", section: "wontdo" },
  ] as TaskItem[];

  it("groups all non-done non-wontdo non-active items in plannedItems", () => {
    const { plannedItems } = computeBuckets(items, null);
    expect(plannedItems.map(i => i.id).sort()).toEqual(["T075", "T076", "T077"]);
  });
  it("excludes the active item from plannedItems", () => {
    const { plannedItems } = computeBuckets(items, "T077");
    expect(plannedItems.map(i => i.id).sort()).toEqual(["T075", "T076"]);
  });
});
```

- [ ] **Step 6: Run vitest on app/project/**

```bash
cd ~/ControlTower && npx vitest run "app/project/" --reporter=dot 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 7: Verify zero leftover identifiers in app/project/ and app/page.tsx**

```bash
cd ~/ControlTower
grep -rE '\b(BacklogItem|BacklogId|AddBacklogDialog|BacklogSection|BacklogSummarySection|backlog_item|backlog_title)\b' "app/project" app/page.tsx | head
grep -rE '/backlog' "app/project" app/page.tsx | head
```
Expected: zero output for both.

- [ ] **Step 8: Commit Pass 4**

```bash
cd ~/ControlTower
git add "app/project" app/page.tsx
git commit -m "refactor: rename Backlog → Tasks in app/project/ pages + UI restructure (pass 4/6)

Directory rename:
- app/project/[id]/backlog/ → app/project/[id]/tasks/

Link hrefs across the app updated. Helper parseBacklogIdNumber renamed
to parseTaskIdNumber and now matches /T(\\d+)/.

UI restructure: the Tasks page consolidates the three legacy section
cards (CEO Requests, Discovered, Triaged) into a single Backlog
collapsible card (open by default), sorted by priority P0→P1→P2 then
ID descending. Done and Won't Do collapsibles unchanged.

Part 4 of the Spec 1 codebase rename."
```

### Task 1.5: Pass 5 — Update `e2e/` Playwright specs

- [ ] **Step 1: Find all e2e references to backlog**

```bash
cd ~/ControlTower
grep -rln 'backlog\|Backlog\|BL-' e2e/ | head
```

- [ ] **Step 2: Apply rewrites in e2e files**

```bash
cd ~/ControlTower
find e2e -type f -name '*.ts' -exec sed -i '' \
  -e 's|/backlog|/tasks|g' \
  -e 's/"Backlog"/"Tasks"/g' \
  -e "s/'Backlog'/'Tasks'/g" \
  -e 's/\bBL-/T/g' \
  {} +
```

- [ ] **Step 3: Verify e2e files have no leftover references**

```bash
cd ~/ControlTower
grep -rE '\b(backlog|Backlog|BL-[0-9])' e2e/ | head
```
Expected: zero output (or only legitimate snake_case in API field names — eyeball any hits).

- [ ] **Step 4: Commit Pass 5 (don't run e2e — that requires the dev server which is mid-migration)**

```bash
cd ~/ControlTower
git add e2e/
git commit -m "refactor: rename Backlog → Tasks in e2e/ Playwright specs (pass 5/6)

URL paths /backlog → /tasks, label strings updated, BL- → T- in any
hardcoded IDs.

E2E tests will be re-run in Phase 4 once the dev server is back up.

Part 5 of the Spec 1 codebase rename."
```

### Task 1.6: Pass 6 — Update `~/ControlTower/.redeye/steering.md`

- [ ] **Step 1: Update steering.md identifiers**

Edit `~/ControlTower/.redeye/steering.md`. Find directives that reference renamed identifiers and update:
- `BacklogItem["status"]` → `TaskItem["status"]`
- `lib/backlog-id.ts` → `lib/task-id.ts` (none currently, but check)
- `safeRedeyePath(p, "backlog.md")` → `safeRedeyePath(p, "tasks.md")` (if mentioned in any directive)
- `parseBacklog` → `parseTasks` (if mentioned)

```bash
cd ~/ControlTower
sed -i '' \
  -e 's/\bBacklogItem\b/TaskItem/g' \
  -e 's/\bparseBacklog\b/parseTasks/g' \
  -e 's|@/lib/backlog-id|@/lib/task-id|g' \
  -e 's|safeRedeyePath(\([^,]*\),\s*"backlog\.md")|safeRedeyePath(\1, "tasks.md")|g' \
  .redeye/steering.md
```

- [ ] **Step 2: Verify**

```bash
cd ~/ControlTower
grep -E '\b(BacklogItem|parseBacklog|backlog\.md)\b' .redeye/steering.md | head
```
Expected: zero output.

- [ ] **Step 3: Commit Pass 6**

```bash
cd ~/ControlTower
git add .redeye/steering.md
git commit -m "refactor: update steering.md identifiers for Backlog → Tasks rename (pass 6/6)

Directive references to BacklogItem, parseBacklog, and backlog.md
filename updated to TaskItem, parseTasks, tasks.md.

This is the final pass of the Spec 1 ControlTower codebase rename.
~/redeye plugin source rename and per-project file migration follow
in Phases 2-3."
```

### Task 1.7: Final ControlTower-side gate

- [ ] **Step 1: Full vitest pass**

```bash
cd ~/ControlTower && npx vitest run --reporter=dot 2>&1 | tail -5
```
Expected: all tests pass (~691 + a few new ones from Pass 4).

- [ ] **Step 2: Full typecheck**

```bash
cd ~/ControlTower && npx tsc --noEmit 2>&1 | grep -vE '\.test\.ts.*Mock' | head -20
```
Expected: no errors except the pre-existing vitest Mock typing noise.

- [ ] **Step 3: Final grep gate for ControlTower codebase**

```bash
cd ~/ControlTower
git grep -E '\b(BacklogItem|BacklogId|AddBacklogDialog|BacklogSection|BacklogSummarySection|parseBacklog|readBacklog|getNextBacklogId|backlog_item|backlog_title|next_bl_id|blId|BL_ID_RE)\b' \
  -- ':!docs' ':!*.md' | head
```
Expected: zero output. Doc files are excluded (the spec, plan, and old commit messages intentionally retain references).

- [ ] **Step 4: Push the branch (or push to main directly per your workflow)**

```bash
cd ~/ControlTower && git push
```
Expected: 6 new commits pushed to origin/main (or whichever branch).

---

## Phase 2: Plugin Source Rename (~/redeye)

This is a single amend + force-push to ~/redeye's initial commit per the existing single-commit repo policy. The migration script (already written in Phase 0) is part of the same amend.

### Task 2.1: Verify ~/redeye starting state

- [ ] **Step 1: Confirm initial commit**

```bash
cd ~/redeye && git log --oneline | wc -l && git log --oneline -3
```
Expected: `1` and a single line showing the initial commit hash.

- [ ] **Step 2: Confirm migration script is present (from Phase 0)**

```bash
[ -x ~/redeye/scripts/migrate-bl-to-t.sh ] && echo "✓ script ready" || echo "✗ run Phase 0 first"
```
Expected: `✓ script ready`.

### Task 2.2: Apply the rename to ~/redeye

- [ ] **Step 1: Rename the template file**

```bash
cd ~/redeye
git mv templates/backlog.md.tmpl templates/tasks.md.tmpl
```

- [ ] **Step 2: Rewrite content references across agents/, scripts/, templates/**

```bash
cd ~/redeye
find agents scripts templates -type f \( -name '*.md' -o -name '*.sh' -o -name '*.tmpl' \) -exec sed -i '' \
  -e 's|\.redeye/backlog\.md|.redeye/tasks.md|g' \
  -e 's|docs/specs/BL-|docs/specs/T|g' \
  -e 's/\bBL-{id}\b/T{id}/g' \
  -e 's/\bBL-\([0-9]\+\)\b/T\1/g' \
  -e 's/\bbacklog_item\b/task_id/g' \
  -e 's/\bbacklog_title\b/task_title/g' \
  -e 's/\bnext_bl_id\b/next_task_id/g' \
  {} +
```

- [ ] **Step 3: Update terminology references (Backlog → Tasks, backlog → tasks) in conceptual prose**

This is a more careful pass — many uses of "backlog" are in narrative paragraphs that should become "tasks". Use sed but review the diff before commit.

```bash
cd ~/redeye
find agents templates -type f \( -name '*.md' -o -name '*.tmpl' \) -exec sed -i '' \
  -e 's/\bbacklog\b/tasks/g' \
  -e 's/\bBacklog\b/Tasks/g' \
  {} +
```

Note: this WILL hit some false positives (e.g., the word "backlog" in a comment about a different thing). Review the diff in Step 5 before committing.

- [ ] **Step 4: Verify no `BL-N` literal references and no `backlog.md` strings remain**

```bash
cd ~/redeye
git grep -E '\b(BL-[0-9]+|backlog\.md|backlog_item|backlog_title|next_bl_id)\b' | head
```
Expected: zero output (or hits only inside `scripts/migrate-bl-to-t.sh` which legitimately references the old names — those are expected).

- [ ] **Step 5: Review the diff carefully**

```bash
cd ~/redeye
git diff --stat
git diff agents/ | head -100
```
Eyeball anything surprising. Common false positives to fix manually:
- "Tasks" capitalized at the start of a sentence that previously read "Backlog" mid-sentence
- The narrative line "the team's backlog" became "the team's tasks" — read OK
- Any hit in scripts/migrate-bl-to-t.sh: the script itself uses "backlog" in literal regex/sed patterns. Make sure those patterns weren't munged. (The find above excludes scripts/ from terminology rewrite, but verify.)

If the diff looks clean, proceed. If something is off, edit by hand.

- [ ] **Step 6: Stage and amend the initial commit**

```bash
cd ~/redeye
git add -A
git commit --amend --no-edit
```

- [ ] **Step 7: Verify HEAD has the new content**

```bash
cd ~/redeye
git log --oneline | wc -l    # should be 1
ls templates/ | grep -E '(backlog|tasks)\.md\.tmpl'    # only tasks.md.tmpl
```

- [ ] **Step 8: Force-push to origin**

```bash
cd ~/redeye && git push --force-with-lease
```
Expected: `+ <old-sha>...<new-sha> main -> main (forced update)`.

---

## Phase 3: Migrate Managed Projects

CTOs are still stopped from Task 1.0. Run the migration script on each project, review the diff, commit, push.

### Task 3.1: Migrate haze (smallest, lowest risk)

- [ ] **Step 1: Run the script on ~/haze**

```bash
bash ~/redeye/scripts/migrate-bl-to-t.sh ~/haze
```
Expected: prints `--- Migration complete. Review: git diff --cached ---`.

- [ ] **Step 2: Review the staged diff**

```bash
cd ~/haze && git diff --cached --stat
cd ~/haze && git diff --cached .redeye/state.json | head -40
cd ~/haze && git diff --cached .redeye/tasks.md | head -40
```
Eyeball: state.json should show key renames + value rewrites; tasks.md should show BL- → T- everywhere.

- [ ] **Step 3: Verify zero leftover BL- references**

```bash
cd ~/haze
git grep --cached -E '\bBL-[0-9]+\b' -- ':!*.bak' | head
```
Expected: zero output.

- [ ] **Step 4: Delete the backup file**

```bash
cd ~/haze && rm -f .redeye/state.json.bak
git add .redeye/state.json.bak 2>/dev/null || true
```

- [ ] **Step 5: Commit and push**

```bash
cd ~/haze
git commit -m "chore: migrate BL- → T- task IDs (Spec 1 of 2)

Renames .redeye/backlog.md → .redeye/tasks.md and rewrites every
BL-<N> reference to T<N> across .redeye/* tracking files,
docs/specs/, and other doc trees.

Migrated by ~/redeye/scripts/migrate-bl-to-t.sh.

See: ~/ControlTower/docs/superpowers/specs/2026-04-26-tasks-rename-design.md"
git push
```

### Task 3.2: Migrate ~/ControlTower itself

ControlTower is BOTH the dashboard codebase AND a managed project (the dashboard reads its own .redeye/ to display "ControlTower" as project index 1). The codebase rename in Phase 1 has already been committed; here we migrate the project files.

- [ ] **Step 1: Run the script**

```bash
bash ~/redeye/scripts/migrate-bl-to-t.sh ~/ControlTower
```

- [ ] **Step 2: Review the staged diff**

```bash
cd ~/ControlTower && git diff --cached --stat
cd ~/ControlTower && git diff --cached .redeye/state.json | head -40
```

- [ ] **Step 3: Final grep gate**

```bash
cd ~/ControlTower
git grep --cached -E '\bBL-[0-9]+\b' -- ':!docs/superpowers' ':!CHANGELOG.md' ':!*.bak' | head
```
Expected: zero output. The spec, plan, and any historical changelog are excluded — they intentionally reference the old prefix.

- [ ] **Step 4: Cleanup backup, commit, push**

```bash
cd ~/ControlTower
rm -f .redeye/state.json.bak
git commit -m "chore: migrate ControlTower's own .redeye/ from BL- to T- (Spec 1 of 2)"
git push
```

### Task 3.3: Migrate ~/redeye (the plugin's own .redeye/)

~/redeye uses RedEye to manage itself. Run the migration on ~/redeye's project files, then amend into the existing initial commit (per the single-commit policy).

- [ ] **Step 1: Run the script**

```bash
bash ~/redeye/scripts/migrate-bl-to-t.sh ~/redeye
```

- [ ] **Step 2: Review**

```bash
cd ~/redeye && git diff --cached --stat
cd ~/redeye && git diff --cached .redeye/state.json | head -40
```

- [ ] **Step 3: Grep gate**

```bash
cd ~/redeye
git grep --cached -E '\bBL-[0-9]+\b' -- ':!*.bak' | head
```
Expected: zero output.

- [ ] **Step 4: Cleanup backup, amend, force-push**

```bash
cd ~/redeye
rm -f .redeye/state.json.bak
git add -A
git commit --amend --no-edit
git push --force-with-lease
```

---

## Phase 4: Smoke Test and Restart

CTOs are still stopped. Bring the dev server back up, verify the renamed UI, then restart the agents.

### Task 4.1: Manual UI smoke test

- [ ] **Step 1: Restart the ControlTower dev server**

If the dev server was running through the rename, kill it and restart so it picks up the new routes:
```bash
# Find the existing dev server pid
pgrep -fa "next dev" | head
# If running, kill it
pkill -f "next dev" || true
# Restart in background
cd ~/ControlTower && npm run dev > /tmp/ct-dev.log 2>&1 &
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/
```
Expected: HTTP 200 from the home page.

- [ ] **Step 2: Verify the Tasks API works for all three projects**

```bash
for project_id in 0 1 2; do
  echo "=== Project $project_id ==="
  curl -s -H 'Origin: http://127.0.0.1:3200' \
    "http://127.0.0.1:3200/api/projects/$project_id/tasks" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print("status:" if "error" in d else "tasks:", d.get("error") or len(d.get("data",{}).get("tasks", [])))'
done
```
Expected: each project returns either an error message OR a count of tasks. None should 500.

- [ ] **Step 3: Open the Tasks tab in a browser**

Open `http://127.0.0.1:3200/project/1/tasks` in a browser. Verify:
- Page loads without errors
- "Currently Working On" card shows the active task with `T<N>` ID
- "Backlog" collapsible is open by default and lists all pending items sorted by priority
- "Done" collapsible is closed by default; expanding shows shipped items with `T<N>` IDs
- "Won't Do" collapsible is closed by default; expanding shows wont-do items
- Click into one task → detail page loads at `/project/1/tasks/T<N>`

- [ ] **Step 4: Add a new task via the dialog**

Click "Add Task" (or whatever the renamed button reads), enter a title, submit. Verify:
- Returns success
- New task appears in Backlog with the next `T<N>` ID (e.g., `T075` for ControlTower)
- Refreshing the page still shows it

- [ ] **Step 5: Delete the test task you just added**

Click into it, delete. Verify it disappears.

- [ ] **Step 6: Test Stop/Pause from the working-on-card**

From the home page or project page, hit Stop. Verify:
- Returns success
- Steering.md gets a `STOP` directive (no BL-)
- Browser shows the project as stopped

### Task 4.2: Restart CTO loops and watch first iteration

- [ ] **Step 1: Restart all three CTOs**

```bash
for project_id in 0 1 2; do
  curl -s -X POST \
    -H 'Origin: http://127.0.0.1:3200' \
    -H 'Sec-Fetch-Site: same-origin' \
    "http://127.0.0.1:3200/api/projects/$project_id/start"
  echo
done
```

- [ ] **Step 2: Wait for the first TRIAGE iteration on each**

```bash
sleep 30
for project_id in 0 1 2; do
  echo "=== Project $project_id ==="
  cd "$(curl -s -H 'Origin: http://127.0.0.1:3200' http://127.0.0.1:3200/api/projects | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][$project_id]['path'])")"
  git log --oneline -1
  cat .redeye/state.json | python3 -c 'import json,sys; s=json.load(sys.stdin); print(f"phase={s.get(\"phase\")} task_id={s.get(\"task_id\")} iter={s.get(\"iteration\")}")'
done
```
Expected: each project shows a recent commit referencing `T<N>` (or no new commit yet — TRIAGE may not have committed). state.json should show `task_id` (not `backlog_item`).

- [ ] **Step 3: Final cross-repo grep gate**

```bash
for repo in ~/redeye ~/ControlTower ~/haze; do
  echo "=== $repo ==="
  cd "$repo" && git grep -E '\b(BL-[0-9]+|backlog\.md|BacklogItem|parseBacklog)\b' \
    -- ':!docs/superpowers' ':!CHANGELOG.md' ':!*.bak' | head -3
done
```
Expected: zero hits in each repo (or only legitimate hits in spec/plan/changelog as noted).

If any hit appears, it's a missed substitution — fix and amend the appropriate commit.

### Task 4.3: Final commit + plan archive

- [ ] **Step 1: Move the plan to the executed/ subdirectory (optional)**

```bash
mkdir -p ~/ControlTower/docs/superpowers/plans/executed
git mv ~/ControlTower/docs/superpowers/plans/2026-04-26-tasks-rename-implementation.md \
       ~/ControlTower/docs/superpowers/plans/executed/2026-04-26-tasks-rename-implementation.md
```

- [ ] **Step 2: Commit the archive**

```bash
cd ~/ControlTower
git commit -m "chore: archive completed Tasks rename plan (Spec 1 of 2)

All steps executed. Spec 2 (subtask decomposition) is now unblocked
and can begin design."
git push
```

---

## Definition of Done

- [ ] `~/redeye` HEAD references `tasks.md`, `T{id}`, `task_id` etc. throughout
- [ ] `~/redeye/scripts/migrate-bl-to-t.sh` exists and is idempotent
- [ ] ControlTower codebase: 6 commits applied, full vitest + tsc green
- [ ] ControlTower's `.redeye/` migrated; no `BL-N` references except in docs/superpowers/* (intentional)
- [ ] Haze migrated; same grep gate clean
- [ ] ~/redeye's own `.redeye/` migrated and amended into HEAD
- [ ] Manual browser smoke: Tasks tab renders, add/edit/delete work, Stop/Pause work
- [ ] All three CTO loops restarted; first TRIAGE iteration on each completes successfully and references `T<N>` IDs
- [ ] Plan moved to `executed/` (optional, marker that this work is complete)
