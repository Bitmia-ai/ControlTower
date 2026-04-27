# Spec: T076 + T099 — Dependency Updates + next.config.test.ts Fix

**Iteration:** 123
**Status:** PLAN complete

---

## T076: Dependency updates — lucide-react, react/react-dom, TypeScript 6.0

### Context

Current versions (from package.json):
- `lucide-react`: ^1.9.0 (latest: 1.11.0)
- `react`, `react-dom`: 19.2.4 (latest: 19.2.5)
- `typescript`: ^5 (latest: 6.0.3)
- `@types/node`: ^20 (latest: 25.6.0)

postcss moderate vulnerability: known/accepted risk — no safe fix without breaking Next.js. Do NOT touch it.

### Sub-tasks

**S1: Update lucide-react**
- Run: `npm install lucide-react@^1.11.0`
- Verify: `npm run build` passes, `npx vitest run` shows no new failures
- Expected: icon API is stable across minor versions, no breaking changes

**S2: Update react and react-dom**
- Run: `npm install react@19.2.5 react-dom@19.2.5`
- Verify: build and vitest pass

**S3: Evaluate TypeScript 6.0**
- Run: `npm install typescript@6 --save-dev`
- Run: `npx tsc --noEmit` to check for type errors
- Run: `npm run build` to verify Next.js compatibility
- If clean: keep TypeScript 6 and record in summary
- If errors: document specific blockers, revert to `^5`, record blockers in summary
- Note: TypeScript 6 has stricter inference in some areas; most issues are minor

**S4: Update @types/node**
- Run: `npm install @types/node@^25 --save-dev`
- Verify: `npm run build` and `npx vitest run` pass
- Note: @types/node ^25 matches Node 22+ LTS

**S5: Final verification**
- Run full: `npx vitest run` — confirm 899 tests still pass (416 passing, 483 pre-existing failures unchanged)
- Run: `NODE_ENV=production npm run build` — confirm clean build
- Record final package versions in summary

---

## T099: Fix next.config.test.ts

### Context

`next.config.test.ts` at the repo root contains 5 valuable tests:
- Cache header rules (/_next/static/*, /api/*) — guards against T075 regressions
- Turbopack root config — guards against T077 regressions

The tests currently **fail** because:
1. The `happy-dom` test environment (vitest default) cannot load `node:` built-in modules
2. `next.config.ts` imports `path` from Node, which happy-dom externalizes
3. Result: "No such built-in module: node:" error, 0 tests execute

vitest.config.ts includes `*.test.{ts,tsx}` at root level, so this file IS included in the suite — it just fails silently (counted as a failed suite, not a failing test).

### Sub-tasks

**S1: Fix the environment annotation**
- Add `// @vitest-environment node` as the first line of `next.config.test.ts`
- This makes vitest run the file in Node.js environment instead of happy-dom
- Pattern matches: `lib/cost-history.test.ts`, `components/__tests__/live/...` which use `@vitest-environment node`

**S2: Verify the tests pass**
- Run: `npx vitest run next.config.test`
- All 5 tests should pass
- These were previously counted as "pre-existing failures" — after fix they move to "passing" column

### Acceptance criteria

- `npx vitest run next.config.test` shows 5 passing tests, 0 failing
- Full `npx vitest run` shows at least 416+5=421 passing (some may have already been miscounted)
- `npm run build` stays clean

---

## Risk Assessment

- **Low risk**: lucide-react minor version bump — icon API stable
- **Low risk**: React 19.2.4→19.2.5 — patch release, no API changes
- **Medium risk**: TypeScript 6.0 — may have type errors; have a revert plan ready
- **Low risk**: @types/node ^20→^25 — type definitions only
- **Low risk**: next.config.test.ts fix — adding environment annotation, not changing behavior

## No CEO questions needed

All decisions are agent-resolvable:
- If TypeScript 6 has errors, document and revert to ^5
- If any dep update breaks tests, revert that specific dep

## Files expected to change

- `package.json` — updated dep versions
- `package-lock.json` — lockfile update
- `next.config.test.ts` — add `// @vitest-environment node` annotation
