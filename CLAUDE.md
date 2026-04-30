# Control Tower — Claude context

Orientation for any Claude Code session working in this repo. Pair with [README.md](README.md) (what users see) and [ARCHITECTURE.md](ARCHITECTURE.md) (code map + flows).

## What this is

A **Next.js 16 / React 19 / TypeScript** dashboard that orchestrates [RedEye](https://github.com/Bitmia-ai/RedEye) sessions across multiple projects from a browser. Single-user, local-only, no database, no auth.

- Server runs at `http://localhost:3200` and binds to `127.0.0.1`
- All durable state is plain markdown + JSON on disk (`.redeye/*.md`, `~/.redeye/config.json`, `~/.claude/projects/*.jsonl`)
- The dashboard reads `.redeye/*` on every poll; it writes only on explicit user actions (Add Task, Steer, Answer, Stop)

## Why these decisions exist

- **No database, no auth, no cloud.** Trust boundary is the user's machine. Anything reachable on `127.0.0.1:3200` already controls Claude Code as that user — adding auth on top would be theater.
- **Production mode is the supported runtime.** Reverse proxies (Tailscale, ngrok), service-worker caching, and self-dogfood deploys all expect `npm start`. `npm run dev` exists only for hacking on Control Tower itself.
- **Webpack for dev, not Turbopack.** Turbopack walks the project root and indexes RedEye's `.worktrees/T-N/` clones, ballooning memory past 80 GB (reproduced 3× before the fix). Webpack honors `watchOptions.ignored` in `next.config.ts`. Don't "modernize" by removing `--webpack`.
- **Single-commit `main` policy.** History is rewritten via `commit --amend` + `push --force`. Never add new commits to `main`. RedEye auto-commits get squashed into the initial commit at each polish round.

## How to work in here

### Run

```bash
npm install
npm run build && npm start         # supported runtime
npm run dev                        # only when editing Control Tower itself
npx next start --hostname 127.0.0.1 --port 4000  # change the port
```

> `PORT=4000 npm start` does not work — the `npm start` script hardcodes `--port 3200`. Use the `npx next start` form above to override.

### Test

```bash
npm test                           # vitest (unit + component)
npm run typecheck                  # tsc --noEmit
npm run e2e                        # Playwright, against a running prod server
```

Always run `typecheck` and `test` before committing. E2E exercises the prod build, so spin up `npm run build && npm start` in another terminal first.

### Commit & push

- **Single-commit policy on `main`.** Edit, then `git commit --amend --no-edit && git push origin main --force`.
- Stage selectively (`git add <file>`), not `git add -A`, when other tooling (RedEye) might be writing.
- Conventional-commit style for the amend message is fine but the canonical commit subject stays `Initial commit: ControlTower v0.1.0`.

### Where things live

| Want to… | Start at |
|----------|----------|
| Add an API endpoint | `app/api/projects/[id]/<route>/route.ts` |
| Change a parser | `lib/redeye-parsers.ts` + `lib/redeye-files.ts` (+ tests) |
| Touch session lifecycle | `lib/session-manager.ts` |
| Adjust cost math | `lib/cost-calculator.ts`, `lib/cost-history.ts`, `lib/cost-forecast.ts` |
| Change the live transcript tail | `app/api/projects/[id]/stream/route.ts` + `lib/transcript-normalizer.ts` |
| Reskin | `app/globals.css` + `tailwind.config.ts` + `components/` |
| Add a CLI command | `bin/` + `lib/ct-init-core.mjs` |

## Conventions

### Code

- **TypeScript strict.** No `any` unless you explain why in a comment.
- **`spawn(cmd, [args])` only.** Never shell-string spawning. Same rule for `execFileSync`.
- **Atomic writes** for every `.redeye/*.md` mutation — temp file + `rename` via `atomicWriteJson` (`lib/atomic-write.ts`). All 8 mutating API routes (steer, tasks, tasks/[taskId], schedules, schedules/run, pause, stop, answer) already use this. New routes must too.
- **CSRF-aware API routes.** `proxy.ts` middleware checks `Origin`/`Sec-Fetch-Site`. New API routes inherit this; don't bypass.
- **Path validation** — anything user-supplied that becomes a path goes through `safeRedeyePath` (`lib/redeye-files.ts`) or the `addProject` realpath check (`lib/projects.ts`).
- **Markdown sanitization** via `lib/markdown-sanitize.ts` (DOMPurify + react-markdown). No raw HTML injection anywhere else in components.

### Files & paths

- **Never write `/Users/<name>/` literals** in source, tests, comments, or docs. Use `/tmp/...`, `/home/user/...`, or `<repo>/...` placeholders.
- The path-mangling format Claude uses for transcripts is `~/.claude/projects/<encoded>/` where `<encoded>` is the project path with `/` → `-`. See `lib/transcript-file-resolver.ts`.

### Tests

- Vitest for unit + component.
- Playwright for E2E in `e2e/`. Specs use fixture project paths like `/tmp/haze` — never real local paths.
- TDD when fixing bugs in parsers (`lib/redeye-parsers.ts`) — there are regression tests for section-boundary detection that any change should preserve.

## Things you should NOT do

- ❌ Add new commits to `main` (always amend + force-push)
- ❌ Bypass the CSRF middleware for "convenience"
- ❌ Switch dev to Turbopack (read `next.config.ts` first)
- ❌ Run `git add -A` blindly — `.redeye/`, `.worktrees/`, and `docs/tasks-archive/` are gitignored *and* untracked, but RedEye writes to them while you work
- ❌ Hardcode user paths or usernames in any file
- ❌ Make the README claim multi-tenant, multi-user, or production-grade — Control Tower is single-user-local-only and the README is honest about that
- ❌ Call `git push --force` to a public branch other than `main` without confirming

## Pointers

- [README.md](README.md) — user-facing pitch, install, usage
- [ARCHITECTURE.md](ARCHITECTURE.md) — code map, request flows, invariants
- [CONTRIBUTING.md](CONTRIBUTING.md) — issue/PR conventions
- [SECURITY.md](SECURITY.md) — vulnerability disclosure
- `lib/CLAUDE.md` — domain-logic specifics
- `e2e/CLAUDE.md` — Playwright conventions
