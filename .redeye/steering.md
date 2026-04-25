
## Directives

### API & security conventions

- Read request bodies via lib/json-body.ts readJsonBody — never req.json() directly. (VERIFIED EDIT BL-072)
- **All `.redeye/*` paths go through `safeRedeyePath(project.path, filename)`** from `lib/redeye-files.ts`. Never inline `path.resolve(project.path, ".redeye", "x.md")`.
- **Validate URL params against strict regex before use** — mirror `QUESTION_ID_RE` (`^Q-\d+$`), `TASK_ID_RE` (`^BL-\d+$`), and the `SCHED-\d+` pattern. User input never reaches a regex builder, file path, or shell argument unvalidated.
- **Atomic writes for `state.json` and any concurrently-mutated file.** Use `atomicWriteJson` from `lib/atomic-write.ts`. Direct `fs.writeFile` on `state.json` is forbidden — multiple routes race.
- **Response envelope is fixed.** Success: `NextResponse.json({ data: ... })`. Failure: `NextResponse.json({ error: "string" }, { status: NNN })`. Codes: 200 happy, 400 client error, 404 missing, 413 too large, 415 wrong content-type, 500 server error.
- **CSRF protection is inherited from `middleware.ts`** (matcher: `/api/:path*`). Don't add a mutating endpoint outside `/api/` that side-steps the matcher.

### Parser/UI alignment

- **New status strings require updating three files in lockstep:** `BacklogItem["status"]` in `lib/redeye-types.ts`, the case branch in `normalizeStatus` in `lib/redeye-parsers.ts`, and the colour map (+ `STATUS_OPTIONS` array) in the backlog list and detail pages. The default branch returns `pending`, which silently surfaces unrecognized statuses as "to-do" in the UI (real bug we hit with `wont-do`).

### Tests

- **Mock parity.** When a route imports a new export from `@/lib/X`, every `vi.mock("@/lib/X", ...)` block in a test file that touches that route must be updated to include the new export. Otherwise the route gets `undefined`, the test silently 500s, and the failure mode is misleading.

### Process / network

