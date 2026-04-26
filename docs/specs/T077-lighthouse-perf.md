# T077 — Lighthouse Baseline + Per-Page Metadata + Chunk Investigation

**Status:** in-progress  
**Priority:** P2  
**Type:** performance  
**Branch:** redeye/T-77  
**Iteration:** 108  

---

## Context

T075 shipped three quick wins: dynamic imports for react-markdown, viewport metadata, and Cache-Control headers. The performance audit doc (docs/performance-audit.md) identified three follow-up recommendations:

1. Run Lighthouse CLI and record actual baseline scores
2. Add per-page `metadata.title` so the browser tab and breadcrumbs show the active section
3. Investigate the 228 KB shared runtime chunk

Additionally, `next.config.ts` has a workspace root warning from Turbopack that can be silenced with a trivial config entry.

---

## Goals

1. Add per-page `metadata.title` exports to all 7 page files — **highest value, ships now**
2. Run a production build and record chunk sizes — documents the 228KB runtime baseline
3. Run Lighthouse via Chrome DevTools protocol and record scores in `docs/lighthouse-report-baseline.md`
4. Add `turbopack: { root: process.cwd() }` (or equivalent) to `next.config.ts` to silence the workspace warning
5. Update `docs/performance-audit.md` with the Lighthouse scores and chunk analysis

---

## Architecture Decisions

- **Per-page metadata:** Use static `export const metadata: Metadata` on non-dynamic pages (home page). For dynamic pages (project sub-pages that need the project name), use `export async function generateMetadata()` with the project id from params, or use a simpler static title like `"Mission Control"` without the project name — this avoids a blocking data fetch at metadata time and keeps things simple. We'll use static titles for now (they compose with the root layout's `template: "%s | Control Tower"`).
- **No new routes or API changes** — this is purely a config/UI enhancement.
- **Lighthouse CLI vs DevTools:** Since we can't spawn a separate server process, we'll document the command and record scores manually from a build that we run and verify is passing. The `docs/lighthouse-report-baseline.md` will contain instructions + placeholders for scores that the next human operator can fill in. Alternatively, if the server is running at localhost:3200, we can use `npx lighthouse` in the test environment.
- **Chunk investigation:** Run `NODE_ENV=production npm run build` and parse the output to identify top contributors. We can use `du -sh .next/static/chunks/*.js` sorted to find the 228KB chunk and identify it by name.

---

## Sub-Tasks

### T1 — Add per-page metadata.title (S) — DONE

**Files to modify:**
- `app/page.tsx` — add `export const metadata: Metadata = { title: "Projects" }`
- `app/project/[id]/page.tsx` — add `export async function generateMetadata({ params })` returning `{ title: "Mission Control" }` (static; we do NOT fetch project name to avoid blocking)
- `app/project/[id]/tasks/page.tsx` — `{ title: "Tasks" }`
- `app/project/[id]/tasks/[taskId]/page.tsx` — `export async function generateMetadata({ params })` returning `{ title: "Task Detail" }` (static)
- `app/project/[id]/live/page.tsx` — `{ title: "Live" }`
- `app/project/[id]/history/page.tsx` — `{ title: "History" }`
- `app/project/[id]/schedules/page.tsx` — `{ title: "Schedules" }`
- `app/project/[id]/steer/page.tsx` — `{ title: "Steer" }`

**Test strategy:** Add/extend vitest unit tests in each page's test file (or create new `.test.ts` files) that verify the `metadata` or `generateMetadata` export exists and has the correct title string. Use the existing pattern from `app/layout.test.tsx`.

**Acceptance criteria:**
- [ ] Each page exports `metadata` or `generateMetadata` with a string `title`
- [ ] Titles compose with root template: e.g. `"Tasks | Control Tower"` in browser tab
- [ ] Tests for each page's metadata export pass
- [ ] All existing 795 tests still pass

### T2 — Turbopack root config (XS) — DONE

**Files to modify:**
- `next.config.ts` — add `experimental: { turbo: { root: process.cwd() } }` or check the correct config key for Next.js 16

**Test strategy:** Run `npm run build` and confirm no "Turbopack workspace root" warning. Existing config tests in `next.config.test.ts` (if any) should still pass.

**Acceptance criteria:**
- [ ] No workspace root warning in `npm run build` output
- [ ] Build is clean, all existing tests pass

### T3 — Chunk analysis and baseline documentation (S) — DONE

**Task:** Run `NODE_ENV=production npm run build`, capture the chunk size output, identify the top 5 JS chunks by size, and write findings to `docs/performance-audit.md` (append a new section) and create `docs/lighthouse-report-baseline.md` with the build output and instructions for running Lighthouse.

**No code changes** — documentation only.

**Acceptance criteria:**
- [ ] `docs/performance-audit.md` updated with chunk analysis section
- [ ] `docs/lighthouse-report-baseline.md` created with build output and Lighthouse instructions
- [ ] Build is clean, all existing tests pass

---

## Test Strategy

- Vitest unit tests for each metadata export (T1)
- `npm run build` clean for T2/T3
- Total new tests expected: ~8-12 (one per page for T1 metadata exports)
- Target: ≥795 tests passing (current baseline: 795)

---

## Risk Assessment

- **Low risk** — no functional code changes to pages, only metadata additions
- T2 (turbopack config) could silently break if the config key changes between Next.js versions — verify against the installed version
- Dynamic pages with `force-dynamic` in layout already handle prerendering correctly

---

## Definition of Done

- [ ] All sub-tasks complete
- [ ] `npx vitest run` — all tests pass
- [ ] `NODE_ENV=production npm run build` — clean
- [ ] Per-page titles visible in browser tabs (verify manually or via Playwright snapshot)
- [ ] T077 marked done in `.redeye/tasks.md`
