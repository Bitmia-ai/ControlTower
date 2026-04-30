# `e2e/` — Playwright end-to-end tests

Per-directory notes that override or extend the root [CLAUDE.md](../CLAUDE.md).

## What goes here

- Full-flow browser tests — happy paths, error paths, accessibility checks
- Each spec is a `*.spec.ts` Playwright file
- Specs run against the **production server** (`npm run build && npm start`) on `http://localhost:3200`

## Conventions

- **Fixture paths.** Use `/tmp/haze` for the standard fake project; `/tmp/my-project` or `/tmp/control-tower` for variants. Never use a real local path.
- **Network mocking.** Stub `/api/projects` and downstream routes with `page.route()`; do not depend on a real RedEye loop running.
- **Selectors.** Prefer `getByRole`, `getByLabel`, and `data-testid` over CSS classes — those churn.
- **One assertion focus per spec.** Smoke specs may exercise multiple flows; feature specs should pin a single behavior.
- **No flaky timing.** Use `await expect(...).toBeVisible()` / `toHaveText()` with auto-retry instead of arbitrary `waitForTimeout`.

## Running

```bash
npm run build && npm start    # in one shell
npm run e2e                   # in another
```

Single spec: `npx playwright test e2e/start-stop-flow.spec.ts`.

## Adding a new spec

1. Name after the user-facing behavior, not the component (`tasks-crud.spec.ts`, not `add-task-dialog.spec.ts`).
2. Mock the project list with `page.route('/api/projects', …)`.
3. Build assertions that survive layout changes — focus on text/role, not pixel positions.
4. If you need a screenshot for debugging, save under `screenshots/` (gitignored). **Don't commit Playwright traces or screenshots.**

## Don't

- ❌ Run E2E against `npm run dev` — service workers and middleware behave differently in dev
- ❌ Hit external APIs from a test
- ❌ Spawn real Claude Code processes; mock the SSE stream instead
- ❌ Depend on `Date.now()` without freezing it (`page.clock`)
