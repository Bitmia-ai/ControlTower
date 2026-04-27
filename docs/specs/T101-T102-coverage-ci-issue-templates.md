# Spec: T101 + T102 — Coverage CI Badge + GitHub Issue Templates (iter 125)

## Tasks

### T101: Coverage report in CI + badge in README

**Why:** vitest already has `@vitest/coverage-v8` in devDependencies. Adding a coverage step
to CI and a badge to README increases trust for OSS contributors.

**Context:** 923 total tests (440 passing, 483 pre-existing failures). The pre-existing
failures are all known/tracked — they are NOT regressions. Coverage threshold must be set
pragmatically to avoid false CI failures from pre-existing test failures.

**Sub-tasks:**
1. Add `"test:coverage": "vitest run --coverage"` to package.json scripts.
2. Add `coverage` section to `vitest.config.ts`:
   - provider: v8
   - reporter: ['text', 'lcov', 'json-summary']
   - include: source files only (no test files)
   - thresholds: lines 30, functions 30, branches 25, statements 30
     (conservative — reflects that 483/923 tests are pre-existing failures;
      threshold will grow as test coverage improves)
3. Update `.github/workflows/test.yml`:
   - In the `unit` job, after `npm test`, add a step `Coverage` that runs `npm run test:coverage`
   - Add Codecov upload step using `codecov/codecov-action@v4` with token secret
     (`secrets.CODECOV_TOKEN` — user must add this in GitHub repo secrets, note in README)
4. Add coverage badge to `README.md` below the existing badges:
   ```
   [![codecov](https://codecov.io/gh/Bitmia-ai/ControlTower/graph/badge.svg)](https://codecov.io/gh/Bitmia-ai/ControlTower)
   ```
5. Add a note to README Quick Start about setting `CODECOV_TOKEN` secret for the coverage
   badge to go live (one sentence).

**No new test files needed** — this task is CI/config only.

### T102: Tune issue templates with OS/Node/RedEye-version fields

**Why:** Current `.md` templates lack structured fields for debugging info (OS, Node version,
RedEye plugin version). GitHub YAML issue forms are more reliable and fillable.

**Current state:** `.github/ISSUE_TEMPLATE/` has `bug_report.md`, `feature_request.md`,
`question.md`. These are old-style markdown templates. We'll replace bug_report and
feature_request with `.yml` structured forms; keep `question.md` as-is (questions are
unstructured).

**Sub-tasks:**
1. Create `.github/ISSUE_TEMPLATE/bug_report.yml` (GitHub structured form):
   - name: Bug report
   - description: Something doesn't work as expected
   - labels: [bug]
   - body:
     - textarea: What happened? (required)
     - textarea: Expected behavior (required)
     - textarea: Steps to reproduce (required, placeholder with numbered steps)
     - textarea: Relevant logs / error output (optional)
     - dropdown: OS (macOS / Linux / Windows / Other) (required)
     - input: macOS/Linux version (e.g. macOS 15.3, Ubuntu 24.04) (required)
     - input: Node version (`node -v`) (required)
     - input: npm version (`npm -v`) (optional)
     - input: Control Tower version (`git rev-parse --short HEAD`) (required)
     - input: Claude Code version (`claude --version`) (optional)
     - input: RedEye plugin version (commit hash from `~/.claude/plugins/cache/*/plugin.json`, or "installed from --plugin-dir") (optional)
     - input: Browser (if UI issue — e.g. Chrome 124, Safari 18) (optional)
     - checkboxes: "I have searched existing issues and this is not a duplicate" (required)
2. Create `.github/ISSUE_TEMPLATE/feature_request.yml`:
   - name: Feature request
   - description: Suggest an improvement or new capability
   - labels: [enhancement]
   - body:
     - textarea: Problem description (what pain point does this solve?) (required)
     - textarea: Proposed solution (required)
     - textarea: Alternatives considered (optional)
     - checkboxes: "This fits a local-only, single-user dashboard" (required) with
       hint "Control Tower is intentionally local-first (127.0.0.1, no auth, no cloud)"
     - textarea: Additional context (optional)
     - checkboxes: "I have searched existing issues" (required)
3. Delete `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md`
   (replaced by yml forms). Keep `question.md`.
4. No code changes, no tests needed (pure config/docs).

## Files Changed

- `package.json` — add `test:coverage` script
- `vitest.config.ts` — add coverage section with thresholds
- `.github/workflows/test.yml` — add Coverage + Codecov upload steps
- `README.md` — add Codecov badge + one-sentence CODECOV_TOKEN note
- `.github/ISSUE_TEMPLATE/bug_report.yml` — new structured form (replaces .md)
- `.github/ISSUE_TEMPLATE/feature_request.yml` — new structured form (replaces .md)
- `.github/ISSUE_TEMPLATE/bug_report.md` — DELETE
- `.github/ISSUE_TEMPLATE/feature_request.md` — DELETE

## Review Checklist

- [ ] `npm run test:coverage` runs locally without error
- [ ] Coverage report generated (text output shows per-file coverage)
- [ ] CI workflow syntax valid (yamllint or GitHub Actions validator)
- [ ] Codecov badge URL correct for `Bitmia-ai/ControlTower`
- [ ] Issue form YAML valid (no syntax errors, required fields properly marked)
- [ ] Bug form has all 5 environment fields (OS, Node, npm, CT version, RedEye version)
- [ ] Old .md templates deleted, new .yml forms in place
- [ ] `npm run build` clean, `npx vitest run` shows same 440 passing / 483 failing

## Non-Goals

- Do NOT set coverage thresholds that would block CI on pre-existing failures
- Do NOT delete `question.md` (still useful as-is)
- Do NOT add coverage to E2E tests (too slow for CI)
- Do NOT publish to npm (T104 — future)
