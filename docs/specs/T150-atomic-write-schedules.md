# T150 — Fix schedules DELETE: replace inline non-unique .tmp write with atomicWriteJson

**Status:** planned  
**Priority:** P1  
**Type:** bug  
**Iteration planned:** 175

---

## Context

`app/api/projects/[id]/schedules/[schedId]/route.ts` lines 62–65 implements its own
write-atomicity pattern:

```ts
const tmpPath = filePath + ".tmp";
await fs.writeFile(tmpPath, updated, "utf-8");
await fs.rename(tmpPath, filePath);
```

This is the exact race that `lib/atomic-write.ts` exists to prevent: two concurrent DELETE
requests in the same Node process both write to `<filePath>.tmp`, the second write clobbers
the first temp file, then whichever rename() arrives last wins — but the content written
is from the request that wrote to the tmpPath most recently, which may not correspond to
the rename winner. The result is silent data corruption of `schedules.md`.

`lib/atomic-write.ts` avoids this by using a unique suffix per write:
`${process.pid}.${crypto.randomBytes(4).toString("hex")}`, guaranteeing no two concurrent
writers share a temp file.

The fix is a one-line import addition and a three-line replacement.

---

## Architecture Decisions

### AD-1: Use `atomicWriteJson` from `lib/atomic-write.ts` — no new utility needed

`atomicWriteJson(targetPath: string, content: string)` accepts a raw string — it is
misnamed for the JSON-only case but in practice writes any string atomically. The existing
helper is the correct call site. No new function or module is needed.

### AD-2: Remove `fs.writeFile` and `fs.rename` imports from the route (if unused after fix)

After replacing the inline write with `atomicWriteJson`, the route no longer calls
`fs.writeFile` or `fs.rename` directly. The `import fs from "fs/promises"` remains
needed for the `fs.readFile` call, so the import itself stays; but
the individual calls are replaced.

### AD-3: Test mock strategy must change from `fs` stubs to `@/lib/atomic-write` stub

The existing test file (`route.test.ts`) mocks `fs/promises` with `writeFile` and `rename`
stubs, and has assertions that check `mockWriteFile` / `mockRename`. After the fix:
- Add `vi.mock("@/lib/atomic-write", ...)` returning a stubbed `atomicWriteJson`
- Remove assertions that inspect `mockWriteFile.mock.calls[0][0]` for `.tmp` suffix
  (that is now an implementation detail of the library, already tested in
  `lib/atomic-write.ts` tests — we do not re-test library internals here)
- Replace with: assert `mockAtomicWriteJson` was called once with the correct target path
  and correct content
- Keep the `mockWriteFile` / `mockRename` mocks in `vi.mock("fs/promises")` since
  `fs.readFile` is still mocked there; just remove assertions on `writeFile`/`rename`

### AD-4: No behavioral change for callers

The external behavior of the route is unchanged: DELETE still returns
`{ data: { success: true, deleted: schedId } }` on success. The only change is
the atomicity guarantee of the write, which was already the intent of the original code.

---

## Sub-task Decomposition

### ST-1 — Patch route.ts: replace inline tmp write with atomicWriteJson

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | none |
| Agent type | Dev (sonnet) |
| Test strategy | Covered by ST-2 (test update) |
| Acceptance criteria | `import { atomicWriteJson } from "@/lib/atomic-write"` added; lines 62-65 (the `tmpPath`/`writeFile`/`rename` block) replaced with a single `await atomicWriteJson(filePath, updated)`; no `const tmpPath` variable remains; the `import fs from "fs/promises"` is kept (still needed for readFile) |
| Status | done |

**Implementation:**

Remove:
```ts
// Write atomically: write to temp file, then rename
const tmpPath = filePath + ".tmp";
await fs.writeFile(tmpPath, updated, "utf-8");
await fs.rename(tmpPath, filePath);
```

Add import at top of file:
```ts
import { atomicWriteJson } from "@/lib/atomic-write";
```

Replace block with:
```ts
await atomicWriteJson(filePath, updated);
```

### ST-2 — Update route.test.ts: replace fs write/rename mocks with atomicWriteJson mock

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1 |
| Agent type | Dev (sonnet) |
| Test strategy | Run `npx vitest run app/api/projects/\\[id\\]/schedules/\\[schedId\\]/route.test.ts` — all existing tests must pass |
| Acceptance criteria | `vi.mock("@/lib/atomic-write", ...)` added exporting a stubbed `atomicWriteJson`; the existing "writes to a .tmp file and renames atomically" test replaced or updated to assert `mockAtomicWriteJson` was called once with `(filePath, updatedContent)`; `mockWriteFile` / `mockRename` assertions on the write path removed; all other tests (400, 404, 200, content-check, 500) still pass unchanged |
| Status | done |

**Key changes to `route.test.ts`:**

1. Add mock before imports:
```ts
vi.mock("@/lib/atomic-write", () => ({
  atomicWriteJson: vi.fn(async () => undefined),
}));
```

2. Import and cast the mock:
```ts
import { atomicWriteJson } from "@/lib/atomic-write";
const mockAtomicWriteJson = atomicWriteJson as ReturnType<typeof vi.fn>;
```

3. Add `mockAtomicWriteJson.mockResolvedValue(undefined)` to `beforeEach`.

4. Replace the "writes to a .tmp file and renames atomically" test with:
```ts
it("delegates write to atomicWriteJson with correct path and content", async () => {
  mockGetProject.mockResolvedValue({ name: "p", path: "/tmp/p" });
  mockReadFile.mockResolvedValue(SAMPLE_MD);
  const [req, ctx] = makeDelete("0", "SCHED-1");
  await DELETE(req, ctx);
  expect(mockAtomicWriteJson).toHaveBeenCalledOnce();
  const [writtenPath, writtenContent] = mockAtomicWriteJson.mock.calls[0] as [string, string];
  expect(writtenPath).toMatch(/schedules\.md$/);
  expect(writtenContent).not.toContain("### SCHED-1:");
  expect(writtenContent).toContain("### SCHED-2:");
});
```

5. Remove `mockWriteFile` / `mockRename` variable declarations and the existing
   `mockWriteFile.mock.calls` / `mockRename.mock.calls` assertions (keeping the
   `fs/promises` mock for `readFile`).

6. Update `beforeEach` to also call `mockAtomicWriteJson.mockResolvedValue(undefined)`.

### ST-3 — Run full test suite

| Attribute | Value |
|-----------|-------|
| Size | S |
| Dependencies | ST-1, ST-2 |
| Agent type | Dev (sonnet) |
| Test strategy | `npx vitest run` — must pass >= 1395 tests |
| Acceptance criteria | Zero regressions; `npm run typecheck` exits 0 |
| Status | done |

---

## Overall Acceptance Criteria

1. `route.ts` no longer contains `filePath + ".tmp"` — the inline non-unique temp file pattern is gone.
2. `route.ts` imports and calls `atomicWriteJson` from `@/lib/atomic-write`.
3. `route.test.ts` mocks `@/lib/atomic-write` and asserts the correct path and content are passed.
4. `npx vitest run` passes with >= 1395 tests; `npm run typecheck` exits 0.
5. No behavioral change to the DELETE endpoint's HTTP interface.

---

## Questions

None. The fix is unambiguous: replace the inline write with the existing library helper.
