# T148 — Clamp unbounded `?limit=N` query param in session-history route

**Status:** done  
**Priority:** P1  
**Type:** bug  
**Iteration planned:** 177

---

## Context

`app/api/projects/[id]/session-history/route.ts` lines 24-31 accept any
`?limit=N` value from the client and pass it directly to
`getSessionHistory(project.path, limit)`. That function fans out over up to
`limit` transcript files — each a multi-MB JSONL file parsed line-by-line via
readline. A caller supplying `?limit=999999` causes the server to hold the
entire event loop while readline-streaming up to 999,999 files, creating a
trivial local DoS vector.

The current code accepts the value as long as it is a finite positive integer:

```ts
const parsed = parseInt(limitParam, 10);
if (Number.isFinite(parsed) && parsed > 0) {
  limit = parsed;          // ← no upper bound
}
```

---

## Architecture Decisions

### AD-1: Clamp at the route boundary with `Math.min(parsed, MAX_LIMIT)`

The fix belongs at the route layer, not inside `getSessionHistory`. The library
function is correct: it returns however many sessions it is asked for. The
caller (the route) is responsible for enforcing a reasonable ceiling. This
keeps the library generic and testable in isolation.

### AD-2: Hard ceiling of 200

The default limit is 50. The History page UI uses at most 50 entries. A ceiling
of 200 provides generous headroom for any future pagination or bulk-export use
case while bounding memory and CPU to a reasonable upper limit. This matches the
task description's explicit example (`Math.min(parsed, 200)`).

### AD-3: Document the cap in the route docstring

The existing single-line docstring at the top of the file will be extended to
note the cap so any future reader understands the 200 is intentional and not an
accidental off-by-one.

### AD-4: Test strategy — route-level unit test, not a library test

Because the clamp lives in the route, the test belongs alongside the route as
`app/api/projects/[id]/session-history/route.test.ts`. Mock `getSessionHistory`
and `getProjectByIndex`, then assert that calling GET with `?limit=999999`
results in `getSessionHistory` being called with `200`, not `999999`.

---

## Sub-task Decomposition

### ST-1 — Apply the clamp in `session-history/route.ts`

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none |
| Agent type | Dev (sonnet) |
| Test strategy | Manual read-through; covered by ST-2 |
| Acceptance criteria | `MAX_LIMIT = 200` constant declared at module scope; `limit = Math.min(parsed, MAX_LIMIT)` used in the parse branch; docstring updated to state "capped at MAX_LIMIT"; no other behavior changes; `npm run typecheck` exits 0 |
| Status | done |

**Exact change to `route.ts`:**

```ts
// GET /api/projects/[id]/session-history
// Returns { data: { sessions: SessionHistoryEntry[] } } sorted ascending by mtime.
// Optional ?limit=N query param (default 50) caps the number of returned sessions.
// Limit is clamped to at most MAX_LIMIT to prevent unbounded transcript fan-out.

import { NextRequest, NextResponse } from "next/server";
import { getProjectByIndex } from "@/lib/projects";
import { getSessionHistory } from "@/lib/cost-history";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ...inside GET:
const limitParam = req.nextUrl.searchParams.get("limit");
let limit = DEFAULT_LIMIT;
if (limitParam !== null) {
  const parsed = parseInt(limitParam, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    limit = Math.min(parsed, MAX_LIMIT);
  }
}
```

### ST-2 — Write unit tests in `session-history/route.test.ts`

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1 |
| Agent type | Dev (sonnet) |
| Test strategy | vitest; mock `@/lib/projects` (getProjectByIndex returns a fake project) and `@/lib/cost-history` (getSessionHistory returns []); call the GET handler with a mocked NextRequest; assert the limit value forwarded to getSessionHistory |
| Acceptance criteria | File created at `app/api/projects/[id]/session-history/route.test.ts`; at minimum the following test cases pass: (a) `?limit=999999` → getSessionHistory called with `200`; (b) `?limit=10` → getSessionHistory called with `10`; (c) no `limit` param → getSessionHistory called with `50` (DEFAULT_LIMIT); (d) `?limit=0` (invalid, non-positive) → falls back to DEFAULT_LIMIT `50`; (e) `?limit=abc` (NaN) → falls back to DEFAULT_LIMIT `50`; (f) `?limit=200` (at ceiling) → getSessionHistory called with `200` (not clamped down); `npx vitest run app/api/projects/\\[id\\]/session-history/route.test.ts` exits 0 |
| Status | done |

**Test file outline:**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/projects", () => ({
  getProjectByIndex: vi.fn(),
}));
vi.mock("@/lib/cost-history", () => ({
  getSessionHistory: vi.fn().mockResolvedValue([]),
}));

import { getProjectByIndex } from "@/lib/projects";
import { getSessionHistory } from "@/lib/cost-history";

const fakeProject = { path: "/tmp/proj", name: "proj" };

function makeReq(limitParam?: string) {
  const url = limitParam
    ? `http://localhost/api/projects/0/session-history?limit=${limitParam}`
    : `http://localhost/api/projects/0/session-history`;
  return new NextRequest(url);
}

beforeEach(() => {
  vi.mocked(getProjectByIndex).mockResolvedValue(fakeProject as never);
  vi.mocked(getSessionHistory).mockResolvedValue([]);
});

describe("GET /session-history limit clamping", () => {
  it("clamps limit=999999 to 200", async () => {
    await GET(makeReq("999999"), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 200);
  });

  it("passes through limit=10 unchanged", async () => {
    await GET(makeReq("10"), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 10);
  });

  it("uses DEFAULT_LIMIT=50 when no param", async () => {
    await GET(makeReq(), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 50);
  });

  it("falls back to DEFAULT_LIMIT for limit=0", async () => {
    await GET(makeReq("0"), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 50);
  });

  it("falls back to DEFAULT_LIMIT for limit=abc", async () => {
    await GET(makeReq("abc"), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 50);
  });

  it("passes limit=200 (at ceiling) unchanged", async () => {
    await GET(makeReq("200"), { params: Promise.resolve({ id: "0" }) });
    expect(getSessionHistory).toHaveBeenCalledWith(fakeProject.path, 200);
  });
});
```

### ST-3 — Run full test suite and typecheck

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1, ST-2 |
| Agent type | Dev (sonnet) |
| Test strategy | `npx vitest run` must report >= 1403 + 6 new tests; `npm run typecheck` exits 0 |
| Acceptance criteria | Zero regressions; total tests >= 1409; typecheck exit 0 |
| Status | done |

---

## Overall Acceptance Criteria

1. `MAX_LIMIT = 200` constant declared in `session-history/route.ts`.
2. `limit = Math.min(parsed, MAX_LIMIT)` replaces the bare `limit = parsed` assignment.
3. Route docstring documents the cap.
4. `app/api/projects/[id]/session-history/route.test.ts` created with >= 6 assertions.
5. Test for `limit=999999` asserts `getSessionHistory` receives `200`.
6. `npx vitest run` passes with >= 1409 tests (1403 baseline + 6 new); `npm run typecheck` exits 0.
7. No change to the route's HTTP response shape, status codes, or error handling.

---

## Questions

None. The fix is unambiguous: one-line clamp at the route boundary, a constant for the
ceiling, and a focused test file. No CEO input required.
