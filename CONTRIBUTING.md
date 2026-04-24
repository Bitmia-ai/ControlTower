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
npm run e2e           # playwright (optional, requires browsers installed)
```

Please add tests for:
- new API routes (mock `session-manager` and `redeye-files`)
- state machine changes (session lifecycle, stall detection)
- parsing changes (`redeye-parsers.ts`)

## Security

See [SECURITY.md](SECURITY.md). Do not open public issues for security bugs.
