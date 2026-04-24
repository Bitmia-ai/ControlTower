# BL-019: Fix cost invariant — session cost can exceed total when cliDir unreadable

**Type:** bug  
**Priority:** P1  
**Status:** done  
**Iteration:** 33  
**Spec author:** VP Engineering

---

## Problem Statement

In `app/api/projects/[id]/cost/route.ts`, total cost and session cost are derived from
different sets of JSONL files:

- **Session cost** — computed from `resolveTranscriptFile(project.path)`, which finds
  the most-recently-modified JSONL in `~/.claude/projects/<encoded>/` (or falls back
  to a redeye session file).
- **Total cost** — computed by reading all `*.jsonl` files via `fs.readdirSync(cliDir)`.

When `cliDir` is **unreadable** (directory missing, permission denied, transient I/O),
the `catch` block leaves `totalCost = 0`. The guard at line 46 only adds `sessionCost`
to `totalCost` when the session file is **outside** `cliDir`. If the session file is
inside `cliDir` and `readdirSync` threw, then:

- `totalCost` = 0 (readdirSync threw, no files summed)
- `sessionCost` = >0 (resolveTranscriptFile found the file independently)

Result: `session > total`, breaking the invariant `total >= session` that the cost card
UI assumes when rendering "This session: $X.XX · Total: $XX.XX".

---

## Architecture Decisions

**AD-1: Apply `Math.max(totalCost, sessionCost)` before returning.**  
Minimum safe fix — one-line guard that restores the invariant regardless of root cause
(directory unreadable, path normalization mismatch, floating-point drift). The fix
lives at the return site in `route.ts`.

**AD-2: Do not change `sumTranscriptFileCost` or transcript-file resolution logic.**  
Library functions are correct. The bug is in how the route assembles results. Narrow
change reduces risk.

**AD-3: Add a dedicated test for the cliDir-unreadable + active-session scenario.**  
The existing test suite asserts `total >= session` for the happy path (lines 85, 100)
but has no test for the failing scenario. Add it in `route.test.ts`.

---

## Sub-tasks

### T1 — Apply invariant guard in route.ts

| Field | Value |
|-------|-------|
| **File** | `app/api/projects/[id]/cost/route.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | none |
| **Status** | done |

**Change:** Insert before the `return` statement:

```ts
totalCost = Math.max(totalCost, sessionCost);
return NextResponse.json({ data: { session: sessionCost, total: totalCost } });
```

**Acceptance criteria:**
- `total >= session` in the response for all code paths.
- No change to other response fields or status codes.
- `npm run build` passes.

---

### T2 — Add regression test: cliDir unreadable with active session

| Field | Value |
|-------|-------|
| **File** | `app/api/projects/[id]/cost/route.test.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1 |
| **Status** | done |

**Description:**  
Add a new `it` block simulating:
- `resolveTranscriptFile` returns an active session file path inside `cliDir`.
- `sumTranscriptFileCost` resolves to `2.50` for that session file.
- `readdirSync` throws `ENOENT` (cliDir unreadable).

Assert: `session: 2.50`, `total >= session` (i.e. `total: 2.50`).

**Acceptance criteria:**
- New test passes with `npx vitest run`.
- Existing tests all pass.

---

### T3 — Verify full test suite green

| Field | Value |
|-------|-------|
| **File** | `app/api/projects/[id]/cost/route.test.ts`, `lib/cost-calculator.test.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | T1, T2 |
| **Status** | done |

**Description:**  
Run `npx vitest run` and confirm zero failures. No code change unless an existing
assertion is incorrect after T1 lands (unlikely — the change is additive).

**Acceptance criteria:**
- `npx vitest run` exits 0 with all suites passing.

---

### T4 — Fix usage attachment in transcript-normalizer.ts (SYS-2)

| Field | Value |
|-------|-------|
| **File** | `lib/transcript-normalizer.ts` |
| **Size** | S |
| **Agent** | Dev (sonnet) |
| **Dependencies** | none |
| **Status** | pending |

**Problem (SYS-2):** In `normalizeAssistant`, the same `usage` object reference is attached to
every `ClaudeStreamEvent` emitted from one assistant envelope. An envelope with three content
blocks (e.g. thinking + text + tool_use) will emit three events, each carrying the full
envelope-level usage. Any future consumer that sums `event.usage.input_tokens` across all
events will triple-count.

**Fix options (pick one):**
1. Attach `usage` only to the last event per envelope (preferred — usage accounts for the
   whole turn, not individual blocks).
2. Add a clear doc comment on `ClaudeStreamEvent.usage` stating: "Present only on the last
   event of an assistant envelope. Do not sum across multiple events from the same envelope."

**Recommended:** Option 1 (last-block only). Eliminates the hazard structurally rather than
relying on callers reading a comment.

**Change:**
```ts
// Before the loop, collect all events first, then attach usage only to the last one.
const events: ClaudeStreamEvent[] = [];
// ... build events without usage ...
if (usage && events.length > 0) {
  events[events.length - 1] = { ...events[events.length - 1], usage };
}
return events;
```

**Acceptance criteria:**
- For an assistant envelope with N content blocks, only the last emitted event carries `usage`.
- All existing `normalizeTranscriptLine` tests pass.
- `npx vitest run` exits 0.

---

## Files to Change

| File | Change type |
|------|-------------|
| `app/api/projects/[id]/cost/route.ts` | 1-line fix before return (done) |
| `app/api/projects/[id]/cost/route.test.ts` | 1 new test case (done) |
| `lib/transcript-normalizer.ts` | Attach usage to last block only (pending) |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `Math.max` masks a deeper double-count bug | Low | Guard is additive safety net; existing logic unchanged |
| Floating-point edge case breaks new test | Low | Use `toBeGreaterThanOrEqual` not exact equality |
| Test mock fragility (fs module) | Medium | Follow existing mock pattern in route.test.ts |
