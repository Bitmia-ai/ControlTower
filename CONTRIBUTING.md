# Contributing to Control Tower

Thanks for considering a contribution. Control Tower is a personal project maintained in spare time; issues and PRs are welcome.

## Before you start

- **Open an issue first** for anything larger than a typo or minor doc fix.
- **Read the [README](README.md)** and skim [CLAUDE.md](CLAUDE.md) for architecture.

## Local development

Prerequisites:
- Node 20+ and npm
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with the [RedEye](https://github.com/Bitmia-ai/RedEye) plugin installed

```bash
git clone https://github.com/Bitmia-ai/ControlTower.git
cd ControlTower
npm install
npm run dev
# open http://localhost:3200
```

Add a project to the dashboard via the "+ Add project" button on the home page, or edit `~/.redeye/config.json` directly.

## Code style

- **TypeScript strict.** All new code must typecheck.
- **Tailwind + semantic class names** for styling. No inline styles unless justified.
- **API routes**: wrap handlers in `try/catch`, return `{ data }` on success and `{ error }` with a status code on failure.
- **No process-spawn string interpolation**: always use `spawn()` with an argument array, never shell strings.
- **Paths**: validate with `realpath()` and confirm they stay inside the configured project directory.
- **State writes**: atomic — temp file + `rename`, same pattern as `.redeye/state.json` in RedEye.
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`.

## Testing

Run the test suite:

```bash
npm run test          # vitest unit tests
npm run typecheck     # tsc --noEmit
npm run e2e           # playwright end-to-end tests
```

### End-to-end tests

The Playwright suite in `e2e/` is a required CI gate — it runs automatically on
every push and pull request via the `e2e` job in
`.github/workflows/test.yml`.

To run the suite locally:

```bash
# Option 1: let Playwright start the prod server for you
CI=1 npm run e2e

# Option 2: keep the prod server running in another terminal
npm run build && npm start
# then in a separate terminal:
npm run e2e
```

`playwright.config.ts` defines a `webServer` block that auto-starts
`npm start` when `CI` is set; locally, an existing server on
`http://127.0.0.1:3200` is reused. Browsers must be installed once with
`npx playwright install chromium`.

Please add tests for:
- new API routes (mock `session-manager` and `redeye-files`)
- state machine changes (session lifecycle, stall detection)
- parsing changes (`redeye-parsers.ts`)

## Security

See [SECURITY.md](SECURITY.md). Do not open public issues for security bugs.

## Publishing to npm

> The package is publish-ready but not yet on npm. Publishing is a manual step reserved for the repo owner.

1. Ensure you are on the `main` branch with all tests passing and the version bumped in `package.json`.
2. Toggle `"private"` from `true` to `false` in `package.json` (it is intentionally `true` in the repo to prevent accidental publishes).
3. Run `npm pack --dry-run` to inspect the tarball contents and verify the size is reasonable (should be well under 2 MB — no `.next/` build artifacts or `node_modules/` are included).
4. Smoke-test the tarball locally:
   ```sh
   npm pack
   # this creates control-tower-X.Y.Z.tgz in the current directory
   mkdir /tmp/ct-test && cd /tmp/ct-test
   npm install /path/to/control-tower-X.Y.Z.tgz
   cd node_modules/control-tower
   npm run build
   npm start          # or: control-tower  (if installed globally)
   ```
5. When satisfied: `npm publish --access public`
6. Restore `"private": true` in `package.json` on `main` after publishing to prevent accidental re-publishes.
