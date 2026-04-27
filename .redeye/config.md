# control-tower — RedEye Configuration

> **CTO operating manual.** Essential config read every iteration. For role details and permissions, see `.redeye/reference.md`.

## Vision

Polish the Control Tower dashboard UI. Test every user interaction using Playwright against haze project at http://localhost:3200. Fix bugs, improve UX, ensure all flows work end-to-end.

## Project

- **Name:** control-tower
- **Repo:** /Users/casa/control-tower
- **Started:** 2026-04-23T22:14:35Z
- **State file:** `.redeye/state.json`

## Roles

| Role | Model | When Spawned |
|------|-------|-------------|
| CTO (you) | sonnet | Every iteration (orchestrator) |
| VP Product | sonnet | PLAN, INCORPORATE |
| VP Engineering | sonnet (S-tier) / opus (M/L-tier) | PLAN |
| Dev (generic) | sonnet | BUILD |
| Dev (specialist) | opus | BUILD (when needed) |
| Ops/SRE | sonnet | DEPLOY, STABILIZE |
| QA Lead | sonnet | BUILD (writes E2E), DEPLOY (runs regression) |
| User Tester | sonnet | Background (after DEPLOY only) |
| Documenter | sonnet | Background (after REVIEW) |
| Security Reviewer | sonnet (S-tier) / opus (M/L-tier) | REVIEW |
| Systems Reviewer | sonnet (S-tier) / opus (M/L-tier) | REVIEW |
| Integration Reviewer | sonnet | REVIEW (M/L-tier only) |
| UX Reviewer | sonnet | REVIEW (if UI touched) |

## Commands

- **Deploy:** `NODE_ENV=production npm run build`
- **Verify:** `echo 'No verify command configured'`
- **Test (unit/integration):** `npx vitest run`
- **Test (E2E):** `echo 'No e2e command configured'`
- **App URL:** `http://localhost:3200`

## Worktree Isolation

- **Enabled:** true

## Wiki Sync

- **Enabled:** false
- **Page ID:** 

## User Tester Personas

_(No personas configured. Run /redeye:init --full to set up.)_

## Phase Machine

**Core cycle:** TRIAGE -> PLAN -> BUILD -> REVIEW -> DEPLOY -> VERIFY -> (back to TRIAGE)

**Side phases:** STABILIZE (broken env), HARDEN (empty backlog), SCHEDULES (overdue tasks), INCORPORATE (CEO answers)

**Hard limits:**
- Max review cycles: 3 (then escalate)
- Max stabilize attempts: 3 (then escalate)
- Max iterations per session: 100

## Engineering Culture

1. **TDD is mandatory.** Tests before or alongside implementation.
2. **Reviews are mandatory.** Every feature goes through REVIEW before DEPLOY.
3. **Use skills.** Agents MUST invoke the appropriate phase skill.
4. **Fail fast.** Fix failing tests before moving on.
5. **Incremental delivery.** Each feature cycle should be deployable.

## Git Safety

1. Never force push.
2. Never `git add .` or `git add -A`. Stage specific files.
3. No interactive rebase.
4. Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
5. One concern per commit.
6. Work on `main` unless CEO directs otherwise.
