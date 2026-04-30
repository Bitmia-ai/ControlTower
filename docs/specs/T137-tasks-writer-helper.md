# T137 — Dedupe `appendCeoTask` markdown writer

**Type:** refactor  
**Priority:** P3  
**Status:** pending

## Problem

Two routes contain near-identical "find `## CEO Requests` header, splice a markdown task block immediately after it" logic:

| Route | Lines | Task-block fields |
|-------|-------|-------------------|
| `app/api/projects/[id]/tasks/route.ts` | 69–80 | id, title, type=feature, priority (variable), status=pending, description? |
| `app/api/projects/[id]/schedules/run/route.ts` | 128–141 | id, title (prefixed "Run schedule: …"), type=scheduled, priority=P1, status=pending, schedule (SCHED-N) |

The insertion algorithm is identical: locate `## CEO Requests`, find the newline after the heading, splice the new block immediately after that newline. The only structural differences are the extra `schedule` field in the schedules route and minor fallback-path wording (see Analysis below).

Any future schema change (e.g. an `author` field, a `description` line) must be applied in two places and will drift.

## Exact diff between the two duplicate blocks

### tasks/route.ts (source of truth)

```text
const descLine = description ? `- **Description:** ${description}\n` : "";
const newItem = `\n### ${itemId}: ${text}\n- **Type:** feature\n- **Priority:** ${priority}\n- **Status:** pending\n${descLine}`;

const ceoHeader = "## CEO Requests";
const ceoIdx = content.indexOf(ceoHeader);
if (ceoIdx !== -1) {
  const insertAt = ceoIdx + ceoHeader.length;
  const nextLine = content.indexOf("\n", insertAt);
  content = content.slice(0, nextLine + 1) + newItem + content.slice(nextLine + 1);
} else {
  content += "\n" + newItem;
}
```

### schedules/run/route.ts

```text
const newItem = `\n### ${taskId}: Run schedule: ${scheduleTitle}\n- **Type:** scheduled\n- **Priority:** P1\n- **Status:** pending\n- **Schedule:** ${scheduleId}\n`;

const ceoHeader = "## CEO Requests";
const ceoIdx = tasksContent.indexOf(ceoHeader);
if (ceoIdx !== -1) {
  const insertAt = ceoIdx + ceoHeader.length;
  const nextLine = tasksContent.indexOf("\n", insertAt);
  tasksContent =
    tasksContent.slice(0, nextLine + 1) +
    newItem +
    tasksContent.slice(nextLine + 1);
} else {
  tasksContent += `\n${ceoHeader}\n${newItem}`;
}
```

### Differences

1. **`schedule?` field** — schedules route appends `- **Schedule:** ${scheduleId}\n`; tasks route has no such line.
2. **`description?` field** — tasks route has an optional description line; schedules route does not.
3. **`type` value** — `"feature"` vs `"scheduled"`.
4. **Fallback path** — tasks route appends `"\n" + newItem` (header already guaranteed by ENOENT initialiser); schedules route appends `"\n" + ceoHeader + "\n" + newItem`. Both are functionally equivalent because both routes initialise content to `"# Tasks\n\n## CEO Requests\n"` on ENOENT, so the else-branch is only reached when the header is genuinely absent from an existing file. The helper will adopt the schedules route's safer fallback (which re-creates the header).

## Architecture decision

Extract a **pure function** `appendCeoTask(content: string, task: TaskSpec): string` to `lib/tasks-writer.ts`.

- Takes the current file content as a string; returns the new content string.
- No file I/O — callers remain responsible for reading and writing `tasks.md`.
- No side effects — makes the function trivially unit-testable.
- Placing it in `lib/` (not extending `lib/redeye-files.ts`) keeps I/O helpers and content-transformation helpers in separate modules, matching the existing pattern (`lib/redeye-parsers.ts` for parsing, `lib/redeye-files.ts` for path resolution/I/O).

### Helper signature

```typescript
export interface TaskSpec {
  id: string;          // e.g. "T042"
  title: string;       // sanitized task title
  type: string;        // e.g. "feature", "scheduled"
  priority: string;    // e.g. "P1"
  status: string;      // e.g. "pending"
  description?: string; // optional description line (tasks route)
  schedule?: string;   // optional SCHED-N reference (schedules route)
}

/**
 * Pure function. Inserts a new markdown task block immediately after the
 * "## CEO Requests" heading in `content`. If the heading is absent, appends
 * a new "## CEO Requests" section at the end of the file.
 *
 * Returns the updated content string. Callers handle file I/O.
 */
export function appendCeoTask(content: string, task: TaskSpec): string
```

The generated block format:

```
\n### {id}: {title}
- **Type:** {type}
- **Priority:** {priority}
- **Status:** {status}
[- **Description:** {description}]   ← only if description present
[- **Schedule:** {schedule}]          ← only if schedule present
```

### Steering constraints respected

- `lib/tasks-writer.ts` is a new module — `safeRedeyePath` is not needed (no I/O).
- No `any` types.
- TypeScript strict mode compliant.
- Exported interface `TaskSpec` rather than inline object type for legibility and testability.

## Sub-task decomposition

### ST-1 — Create `lib/tasks-writer.ts` + `lib/tasks-writer.test.ts`

**Size:** S  
**Dependencies:** none  
**Agent type:** Dev (generic)  
**Status:** done

**What to build:**
- `lib/tasks-writer.ts` exports `appendCeoTask(content, task)` and `TaskSpec` interface.
- `lib/tasks-writer.test.ts` covers:
  1. Header present — task block inserted immediately after `## CEO Requests\n`
  2. Header present with existing items — new item appears before existing items (top-insertion)
  3. Header absent — `## CEO Requests` section created at end
  4. `description` field present — line rendered
  5. `description` field absent — line omitted
  6. `schedule` field present — line rendered
  7. `schedule` field absent — line omitted
  8. Both `description` and `schedule` present
  9. Empty string content (edge) — header section created
  10. Content with only whitespace after header (no trailing newline) — handled gracefully

Minimum 10 test cases.

**Acceptance criteria:**
- `npx vitest run lib/tasks-writer.test.ts` passes all cases.
- `npm run typecheck` exits 0.
- Function is pure: no imports of `fs`, `path`, or any I/O module.

### ST-2 — Update `tasks/route.ts` to use helper

**Size:** S  
**Dependencies:** ST-1  
**Agent type:** Dev (generic)  
**Status:** done

**What to change:**
- Import `appendCeoTask` from `@/lib/tasks-writer`.
- Replace lines 69–80 (manual block construction + insert logic) with a call to `appendCeoTask(content, { id: itemId, title: text, type: "feature", priority, status: "pending", description: description || undefined })`.
- Remove now-unused `ceoHeader` / `ceoIdx` / `insertAt` / `nextLine` locals.
- `vi.mock("@/lib/tasks-writer", ...)` is **not** needed in `tasks/route.test.ts` — the existing tests mock `fs/promises` and assert on the written content, which still exercises the helper indirectly. Mock-parity steering note: only add a mock if the route's test file already mocks `@/lib/tasks-writer`.

**Acceptance criteria:**
- `npx vitest run app/api/projects/\\[id\\]/tasks/route.test.ts` passes unchanged (all existing assertions still hold).
- `npm run typecheck` exits 0.
- No new test file needed; existing tests validate correctness via the `writeFile` call assertions.

### ST-3 — Update `schedules/run/route.ts` to use helper

**Size:** S  
**Dependencies:** ST-1  
**Agent type:** Dev (generic)  
**Status:** done

**What to change:**
- Import `appendCeoTask` from `@/lib/tasks-writer`.
- Replace lines 128–141 (manual block construction + insert logic) with a call to `appendCeoTask(tasksContent, { id: taskId, title: \`Run schedule: ${scheduleTitle}\`, type: "scheduled", priority: "P1", status: "pending", schedule: scheduleId })`.
- Remove now-unused `ceoHeader` / `ceoIdx` / `insertAt` / `nextLine` locals.
- `schedules/run/route.test.ts` mocks `fs/promises` and asserts written content — no mock needed for `@/lib/tasks-writer`. Verify mock-parity: the mock block at the top of `schedules/run/route.test.ts` does NOT mock `@/lib/tasks-writer`, so the helper executes for real. This is correct — the tests' written-content assertions will continue to hold.

**Acceptance criteria:**
- `npx vitest run app/api/projects/\\[id\\]/schedules/run/route.test.ts` passes unchanged (all 13 existing assertions hold).
- `npm run typecheck` exits 0.
- No new test file needed.

## Test strategy

- ST-1 introduces the unit tests for the helper (10+ cases, pure function — easy to test exhaustively).
- ST-2 and ST-3 rely on the existing route tests as regression guards. Because both route tests mock `fs/promises` and assert on the *written string*, the refactor is transparent to them — the helper is called with real arguments and its output is passed to `mockWriteFile`, which the tests then inspect.
- Full suite run (`npx vitest run`) after ST-3 must show no regressions.

## Questions posted to CEO inbox

None. The helper signature, file location, and test strategy are unambiguous from reading the two routes. No CEO input required.

## Overall acceptance criteria

1. `lib/tasks-writer.ts` exists, exports `appendCeoTask` + `TaskSpec`, has no I/O imports.
2. `lib/tasks-writer.test.ts` passes with ≥10 assertions.
3. Both `tasks/route.ts` and `schedules/run/route.ts` use `appendCeoTask`; the manual insert logic is deleted from both.
4. All pre-existing route tests (`tasks/route.test.ts` and `schedules/run/route.test.ts`) pass without modification.
5. `npm run typecheck` exits 0.
6. `npx vitest run` full suite passes (≥1577 tests, baseline from iter 186).
