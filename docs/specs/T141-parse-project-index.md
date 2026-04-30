# T141 — Refactor: replace inconsistent parseInt + isNaN guards with parseProjectIndex helper

**Status:** planned  
**Priority:** P2  
**Type:** refactor  
**Iteration planned:** 181

---

## Context

Every dynamic route under `app/api/projects/[id]/` parses the `id` URL param with
`parseInt(id, 10)` before calling `getProjectByIndex(index)`. The handling of a
non-numeric `id` is inconsistent across the 39 route files:

| Pattern | Routes | Behaviour on bad id |
|---------|--------|---------------------|
| `parseInt` with no isNaN guard | 21 routes (start, stop, answer, sessions, steer ×4, tasks ×3, schedules ×2, cost, cost-start, cost-history, cost-snapshot, force-stop, pause, stream, session-history, transcript-status, schedules/run, schedules/[schedId], [id] GET/DELETE) | `getProjectByIndex(NaN)` returns `null` → **404 "Project not found"** |
| `parseInt` + `Number.isNaN` guard returning 404 | 3 routes (cost-forecast, velocity, tasks/[taskId]/duration) | **404 "Project not found"** |
| `parseInt` + `isNaN` guard returning 400 | 1 route (restart) | **400 "id must be a number"** |

The `restart` route is the only one that returns the correct 400 for a client error
(malformed input). All other routes return 404 for the same input, which makes the
error misleading — 404 implies the project exists but was not found, whereas 400
signals that the request itself is malformed.

---

## Architecture Decisions

### AD-1: Add `parseProjectIndex(id: string): number | null` to `lib/projects.ts`

The helper lives in `lib/projects.ts` alongside `getProjectByIndex` because:
- It is the logical companion to that function.
- It is already imported by every affected route (`import { getProjectByIndex } from "@/lib/projects"`), so no new import line is needed in any route.
- `lib/` has no framework coupling — pure function, easily testable.

The function returns `null` for any input that is not a non-negative integer:
- Non-numeric strings (`"abc"`, `""`, `"  "`)
- Floats (`"1.5"` — `parseInt` parses this to `1` but the string has non-integer content, so we should cross-check with `String(parsed) !== id.trim()` or use a strict integer regex)
- Negative integers (`"-1"`)
- `NaN` results from `parseInt`

Implementation approach: strict regex `^(0|[1-9]\d*)$` — no ambiguity from `parseInt`
parsing `"  3"` or `"3abc"` as `3`. This is stricter than `parseInt` alone.

### AD-2: Uniform 400 error message across all routes

Every route will return:
```json
{ "error": "id must be a non-negative integer" }
```
with status `400` when `parseProjectIndex` returns `null`.

This matches the existing API envelope convention (`{ error: "string" }`) documented in
`steering.md`. The `restart` route currently uses `"id must be a number"` — this will
be updated to use the new helper and message for consistency.

### AD-3: Routes call `parseProjectIndex` then `getProjectByIndex`

The two-step pattern after the refactor:
```ts
const index = parseProjectIndex(id);
if (index === null) {
  return NextResponse.json({ error: "id must be a non-negative integer" }, { status: 400 });
}
const project = await getProjectByIndex(index);
if (!project) {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}
```

This replaces every existing combination of bare `parseInt` or `parseInt + isNaN`.

### AD-4: No change to `getProjectByIndex` signature

`getProjectByIndex` continues to accept `number`. The guard is in the route layer, not
in the lib layer — routes own the HTTP status code decision.

### AD-5: Test mock parity — `parseProjectIndex` must be added to every `vi.mock("@/lib/projects")` block

Steering constraint: every `vi.mock("@/lib/projects", ...)` factory must export
`parseProjectIndex` alongside `getProjectByIndex`. If omitted the route gets `undefined`
and silently 500s. The BUILD agent must audit all 22 test files with a `lib/projects`
mock and add `parseProjectIndex: vi.fn()` to each factory.

Most route tests will delegate the "bad id → 400" assertion to the real implementation
rather than mocking, because `parseProjectIndex` is pure and cheap — or they can mock
it returning `null` to test the 400 branch. Either approach is acceptable; the spec
tests (ST-3) lock in the 400 assertion per route.

---

## Audit: Affected Route Files

24 production route files contain `parseInt(id, 10)` or a bare `getProjectByIndex(index)`
without a proper 400 guard:

### Under `app/api/projects/[id]/`:
1. `route.ts` — GET (line 20) and DELETE (line 65)
2. `answer/route.ts` — POST (line 21)
3. `cost/route.ts` — GET (line 29)
4. `cost-forecast/route.ts` — GET (line 22, has `Number.isNaN` → 404, fix to 400)
5. `cost-history/route.ts` — GET (line 15)
6. `cost-snapshot/route.ts` — POST (line 37)
7. `cost-start/route.ts` — POST (line 33)
8. `force-stop/route.ts` — POST (line 17)
9. `init/route.ts` — POST (line 43)
10. `pause/route.ts` — POST (line 13)
11. `restart/route.ts` — POST (line 11, has `isNaN` → 400, **update to helper + new message**)
12. `session-history/route.ts` — GET (line 22)
13. `sessions/route.ts` — GET (line 13)
14. `start/route.ts` — POST (line 13)
15. `steer/route.ts` — GET (line 20), POST (line 41), PATCH (line 112), DELETE (line 191)
16. `stop/route.ts` — POST (line 17)
17. `stream/route.ts` — GET (line 27)
18. `transcript-status/route.ts` — GET (line 29)
19. `velocity/route.ts` — GET (line 21, has `Number.isNaN` → 404, fix to 400)

### Under `app/api/projects/[id]/schedules/`:
20. `route.ts` — GET (line 38) and POST (line 108)
21. `run/route.ts` — POST (line 33)
22. `[schedId]/route.ts` — DELETE (line 30)

### Under `app/api/projects/[id]/tasks/`:
23. `route.ts` — GET (line 19) and POST (line 19)
24. `[taskId]/route.ts` — GET (line 22), PATCH (line 56), DELETE (line 211)
25. `[taskId]/duration/route.ts` — GET (line 28, has `Number.isNaN` → 404, fix to 400)

**Total: 25 route files, 32 individual parseInt call sites.**

---

## Sub-task Decomposition

### ST-1 — Add `parseProjectIndex` to `lib/projects.ts` + unit tests

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none |
| Agent type | Dev (sonnet) |
| Test strategy | Add tests to `lib/projects.test.ts` in a new `describe("parseProjectIndex")` block |
| Acceptance criteria | See below |
| Status | done |

**Implementation:**
```ts
/**
 * Parse a URL param as a non-negative integer project index.
 * Returns null for any non-integer, negative, or non-numeric input.
 * Uses a strict regex — no parseInt ambiguity with leading zeros or partial parses.
 */
export function parseProjectIndex(id: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(id)) return null;
  return parseInt(id, 10);
}
```

**Test cases (minimum 8):**
1. `"0"` → `0`
2. `"1"` → `1`
3. `"42"` → `42`
4. `"abc"` → `null`
5. `""` → `null`
6. `"-1"` → `null`
7. `"1.5"` → `null`
8. `"01"` → `null` (leading zero — not a valid index representation)
9. `" 3"` (leading space) → `null`
10. `"3abc"` → `null`

---

### ST-2 — Update all 25 affected route files to use `parseProjectIndex`

| Attribute | Value |
|-----------|-------|
| Size | M |
| Dependencies | ST-1 |
| Agent type | Dev (sonnet) |
| Test strategy | All existing route tests must still pass; the 400 branch is verified in ST-3 |
| Acceptance criteria | See below |
| Status | done |

**Per-route change pattern:**

Replace:
```ts
const index = parseInt(id, 10);
// (optional) if (isNaN(index) || Number.isNaN(index)) { return ... 404 ... }
const project = await getProjectByIndex(index);
```

With:
```ts
const index = parseProjectIndex(id);
if (index === null) {
  return NextResponse.json({ error: "id must be a non-negative integer" }, { status: 400 });
}
const project = await getProjectByIndex(index);
```

Also update import lines from:
```ts
import { getProjectByIndex } from "@/lib/projects";
```
to:
```ts
import { getProjectByIndex, parseProjectIndex } from "@/lib/projects";
```

**Special cases:**
- `steer/route.ts` has 4 handler functions each with their own `parseInt`. Each gets the same pattern applied.
- `tasks/[taskId]/route.ts` has 3 handler functions. Each gets the same pattern.
- `schedules/route.ts` has 2 handlers (GET + POST). Each gets the same pattern.
- `route.ts` (top-level [id]) has GET and DELETE — both get the same pattern.

---

### ST-3 — Update existing route tests to assert 400 (not 404) for bad id

| Attribute | Value |
|-----------|-------|
| Size | M |
| Dependencies | ST-1, ST-2 |
| Agent type | Dev (sonnet) |
| Test strategy | For each route that has a test file, verify or add an assertion that `id="abc"` (or similar) → 400 with `{ error: "id must be a non-negative integer" }` |
| Acceptance criteria | See below |
| Status | done |

**Affected test files (22 files with `vi.mock("@/lib/projects")`):**

For each test file:
1. Add `parseProjectIndex: vi.fn()` to the `vi.mock("@/lib/projects", ...)` factory.
2. In the existing "bad id" test (if present), update expected status from `404` to `400` and error message to `"id must be a non-negative integer"`.
3. If no "bad id" test exists, add one: call the handler with `id = "abc"`, assert status `400`, assert `json.error` equals `"id must be a non-negative integer"`.

**Note on mock strategy for `parseProjectIndex`:**

Two approaches are valid:
- **Real function** (preferred for simple cases): do NOT mock `parseProjectIndex` — let
  the real implementation run. The factory still needs `parseProjectIndex` in the mock
  object so the import resolves, but it can be set to `vi.fn().mockImplementation(...)` 
  calling through to the real function, or the mock factory can use `importOriginal`.
- **Mock returning null**: set `mockParseProjectIndex.mockReturnValue(null)` for the 400 test,
  and `mockParseProjectIndex.mockReturnValue(0)` for normal tests.

The BUILD agent should use whichever approach is already established in the file. For
most files, letting the real `parseProjectIndex` run is cleaner since it's a pure function
with no I/O.

**Files requiring "bad id → 400" test addition or update:**
- `[id]/route.test.ts`
- `[id]/answer/route.test.ts`
- `[id]/cost/route.test.ts`
- `[id]/cost-forecast/route.test.ts`
- `[id]/cost-history/route.test.ts`
- `[id]/cost-start/route.test.ts`
- `[id]/force-stop/route.test.ts`
- `[id]/init/route.test.ts`
- `[id]/pause/route.test.ts`
- `[id]/restart/route.test.ts` — existing "returns 400 if id is not a number" test must update error message
- `[id]/session-history/route.test.ts`
- `[id]/sessions/route.test.ts`
- `[id]/start/route.test.ts`
- `[id]/steer/route.test.ts`
- `[id]/stop/route.test.ts`
- `[id]/stream/route.test.ts`
- `[id]/velocity/route.test.ts`
- `[id]/schedules/route.test.ts`
- `[id]/schedules/run/route.test.ts`
- `[id]/schedules/[schedId]/route.test.ts`
- `[id]/tasks/route.test.ts`
- `[id]/tasks/[taskId]/route.test.ts`
- `[id]/tasks/[taskId]/duration/route.test.ts`
- `[id]/cost-snapshot/route.test.ts`
- `[id]/transcript-status/route.test.ts`

---

### ST-4 — Run full vitest suite + typecheck

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1, ST-2, ST-3 |
| Agent type | Dev (sonnet) |
| Test strategy | `npx vitest run` must pass >= 1499 tests (net gain from new ST-1 unit tests + ST-3 additions); `npm run typecheck` exits 0 |
| Acceptance criteria | Zero regressions; all new tests pass; typecheck clean |
| Status | done |

ST-4 result: vitest 1536/1536 pass, typecheck exit 0.

---

## Overall Acceptance Criteria

1. `lib/projects.ts` exports `parseProjectIndex(id: string): number | null` — strict regex, no parseInt ambiguity.
2. All 25 affected route files import and call `parseProjectIndex` before `getProjectByIndex`.
3. Every route returns `{ error: "id must be a non-negative integer" }` with status `400` when given a non-integer id — no route returns 404 for that input.
4. All 25 route test files have `parseProjectIndex: vi.fn()` in their `vi.mock("@/lib/projects")` factories.
5. All 25 route test files assert status `400` (not `404`) for a bad id input.
6. `npx vitest run` passes >= 1499 tests; `npm run typecheck` exits 0.
7. No behavioral change for valid integer ids — existing 200/404 happy-path tests still pass unmodified.

---

## Questions

None — no CEO input required. The 400 vs 404 distinction is unambiguous (400 = client
error in the request; 404 = the addressed resource does not exist). The error message
`"id must be a non-negative integer"` is self-documenting. The strict regex over a bare
`parseInt` is a minor technical choice but has no user-visible impact beyond rejecting
`"01"` and `"1.5"` — both of which are not valid project index representations.
