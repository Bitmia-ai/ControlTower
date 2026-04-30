# T143 — Wire Playwright e2e tests into CI workflow

**Status:** pending  
**Type:** chore  
**Priority:** P2  
**Tier:** S  

---

## Problem

`e2e/` contains 32 Playwright specs (~3729 lines) that are never run in CI.
`.github/workflows/test.yml` runs `vitest`, `typecheck`, `lint`, and a production
build — but nothing runs `npm run e2e`. Contributors who look at the
`package.json` `e2e` script or the `e2e/` directory have no signal about whether
these tests are expected to pass in CI or only locally.

---

## Architecture decisions

### AD-1: Option (a) — add a CI `e2e` job, not documentation-only

The test suite is well-suited for CI:
- Every spec mocks all API routes via `page.route()` — no real RedEye loop or
  `.redeye/` state is needed at runtime.
- `playwright.config.ts` already sets `workers: 1` and `retries: 2` to handle
  timing-sensitive specs (phase-change-toast, cost-card), making the suite
  deterministic on a single CI worker.
- The only missing CI requirement is a running Next.js production server.

Option (b) (document as manual-only) would leave 3729 lines of test code as dead
weight and signal to contributors that e2e quality is optional.

### AD-2: Add `webServer` config to `playwright.config.ts`

Currently `playwright.config.ts` has no `webServer` block; it assumes a server is
already running at port 3200. For CI this must be automated.

Playwright's built-in `webServer` config (`command`, `url`, `reuseExistingServer`)
is the canonical solution:

```ts
webServer: {
  command: "npm start",
  url: "http://127.0.0.1:3200",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
```

- `command: "npm start"` starts the production server (the only supported
  runtime per `e2e/CLAUDE.md`).
- `reuseExistingServer: !process.env.CI` lets developers keep their existing local
  workflow (start the server manually, run `npm run e2e`) while CI always starts
  fresh.
- `timeout: 120_000` gives the Next.js server 2 minutes to boot, which is
  sufficient even on cold CI nodes.
- No `PORT` env var override needed; `package.json start` hardcodes `--port 3200`
  and the config references `127.0.0.1:3200` to match.

This approach does NOT require changing the `npm run e2e` script.

### AD-3: Separate `e2e` job (not a step in the existing `unit` job)

Reasons for a separate job:
- The e2e suite needs a production `npm run build` first; the `unit` job does not
  build.
- A 15-minute e2e job running in parallel with `unit` keeps total CI wall time
  lower than serializing them.
- Failure isolation: a flaky e2e spec does not block the unit-test signal.
- Separate artifact upload scope (HTML report on e2e failure only).

The `e2e` job depends on the existing `build` job completing successfully
(`needs: build`) to reuse the build cache and confirm the production bundle is
valid before running browser tests against it.

### AD-4: `playwright install --with-deps chromium` — browsers not cached separately

`actions/setup-node` caches `node_modules` but not Playwright browser binaries.
On `ubuntu-latest` the `--with-deps` flag installs OS-level dependencies (libnss,
libatk, libgbm, etc.) as well as the Chromium binary. The job runs
`npx playwright install --with-deps chromium` before `npm run e2e`.

Only `chromium` is installed because `playwright.config.ts` defines a single
`chromium` project. Installing all browsers would add ~500 MB and 2 minutes of
download time for unused binaries.

### AD-5: HTML report artifact on failure

`playwright test` emits an HTML report to `playwright-report/` by default.
Uploading it on failure gives contributors a visual diff without having to
re-run the suite locally. The artifact is retained for 7 days.

### AD-6: No environment variables needed

The `baseURL` in `playwright.config.ts` is already `http://localhost:3200`. The
`webServer` config starts the server on the same address. No `BASE_URL` env var
override is required.

---

## Sub-task decomposition

### ST-1 — Update `playwright.config.ts` to add `webServer` config

**Size:** S  
**Agent:** Dev (generic)  
**Dependencies:** none  
**Status:** pending

Changes:
- Add `webServer` block (see AD-2 above).
- Verify local workflow still works: `npm run build && npm run e2e` continues to
  function because `reuseExistingServer: !process.env.CI` means if the dev already
  started the server, Playwright reuses it.

Test strategy:
- No new unit tests needed (config-only change).
- Acceptance: `npx tsc --noEmit` exits 0 on the updated config file.

Acceptance criteria:
- `playwright.config.ts` contains a `webServer` block with `command: "npm start"`,
  `url: "http://127.0.0.1:3200"`, `reuseExistingServer: !process.env.CI`, and
  `timeout: 120_000`.
- `npm run typecheck` exits 0.

---

### ST-2 — Add `e2e` job to `.github/workflows/test.yml`

**Size:** S  
**Agent:** Dev (generic)  
**Dependencies:** ST-1  
**Status:** pending

Changes to `.github/workflows/test.yml`:

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: build
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm

    - name: Install
      run: npm ci

    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium

    - name: Build
      run: npm run build

    - name: Run e2e tests
      run: npm run e2e

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

Notes:
- `needs: build` ensures the production bundle is validated by the existing
  `build` job before e2e runs.
- A separate `Build` step is still required in the `e2e` job because GitHub
  Actions jobs do not share filesystem state. The `npm run build` output
  (`.next/`) must be present in this job's workspace for `npm start` to serve it.
- `timeout-minutes: 15` matches the task description requirement and prevents
  runaway jobs if the server fails to start or a test hangs.
- `if: failure()` on the artifact upload means the 30–50 MB HTML report is only
  uploaded when something goes wrong, saving storage on every green run.

Test strategy:
- Push to a branch and observe the Actions tab; confirm the `e2e` job appears and
  either passes or fails with useful output.
- No unit tests for CI YAML.

Acceptance criteria:
- `.github/workflows/test.yml` has an `e2e` job with `needs: build`,
  `timeout-minutes: 15`, `playwright install --with-deps chromium`,
  `npm run e2e`, and conditional artifact upload.
- The job appears in the Actions tab on push.

---

### ST-3 — Update `CONTRIBUTING.md` e2e section

**Size:** S  
**Agent:** Dev (generic)  
**Dependencies:** ST-2  
**Status:** pending

Update the "Testing" section of `CONTRIBUTING.md` to:
1. Remove the `(optional, requires browsers installed)` parenthetical from the
   `npm run e2e` line — e2e is now a required CI gate.
2. Add a note that `npm run build && npm start` must be running in a separate
   terminal before `npm run e2e` is invoked locally (or rely on the `webServer`
   auto-start which happens when CI is not set).
3. Reference that e2e runs automatically in CI on every push/PR via the `e2e` job
   in `test.yml`.

Test strategy:
- Docs-only change; no automated tests.
- Acceptance: `git grep "optional, requires browsers"` returns 0 hits.

Acceptance criteria:
- `CONTRIBUTING.md` testing section accurately describes both the local workflow
  and the CI behavior.
- No reference to e2e being optional remains.

---

## Files touched

| File | Change |
|------|--------|
| `playwright.config.ts` | Add `webServer` block (ST-1) |
| `.github/workflows/test.yml` | Add `e2e` job (ST-2) |
| `CONTRIBUTING.md` | Update testing section (ST-3) |

---

## Questions posted to inbox

None. The task description offered two options; this spec selects option (a)
as clearly superior (well-mocked suite, deterministic config, low CI cost).
No ambiguous decisions remain.

---

## Acceptance criteria (task-level)

- [ ] `playwright.config.ts` has `webServer` block that auto-starts the prod
      server in CI and reuses an existing server locally.
- [ ] `.github/workflows/test.yml` has an `e2e` job: `needs: build`,
      `timeout-minutes: 15`, `playwright install --with-deps chromium`,
      `npm run e2e`, HTML report artifact upload on failure.
- [ ] `CONTRIBUTING.md` accurately describes the e2e workflow (local + CI).
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` (vitest) continues to pass — no production code changes.
- [ ] `git grep "optional, requires browsers"` returns 0 hits in `CONTRIBUTING.md`.
