# UI Redesign — status & resume guide

This doc captures everything needed to pick the redesign back up after a
break. The work lives on the **`ui_redesign`** branch; merge target is
`main`.

## TL;DR

Phases 1–5 plus a Phase 4 polish pass have shipped on `ui_redesign`.
Phase 6 (verify + cleanup) is in progress. The design bundle that the
redesign was built from is checked in at
[`docs/redesign-source/`](redesign-source/).

```
git checkout ui_redesign
npm install
npm run dev          # localhost:3200, webpack dev mode
```

The dev server now emits proper no-cache headers. If you still see "old
UI", it's a stale prod service worker — `components/service-worker-registrar.tsx`
auto-unregisters in dev, but if your browser has it stuck, do
DevTools → Application → Storage → "Clear site data" and reload.

## Where things live

| Artifact | Path |
|---|---|
| Design tokens (oklch) | `app/globals.css` |
| Inline icon + logo | `components/redesign/{icon,logo}.tsx` |
| Phase pipeline + spark | `components/redesign/{phase-pipeline,spark,phases}.tsx` |
| Global TopBar | `components/redesign/top-bar.tsx` |
| Mobile bottom tab bar | `components/redesign/mobile-tab-bar.tsx` |
| Fleet summary card | `components/redesign/fleet-summary.tsx` |
| Inbox card (federated) | `components/redesign/inbox-card.tsx` |
| Project card | `components/redesign/project-card-new.tsx` |
| Project shell + 3 tabs | `components/redesign/project-shell.tsx` |
| Modal primitive | `components/redesign/modal-shell.tsx` |
| Now view | `app/project/[id]/now-client.tsx` |
| Global activity page | `app/activity/{page,activity-client}.tsx` |
| Global inbox page | `app/inbox/{page,inbox-client}.tsx` |
| Fleet API endpoints | `app/api/{inbox,activity}/route.ts`, `app/api/projects/route.ts` |
| Design bundle (source) | `docs/redesign-source/` |

## What shipped (commit-by-commit)

```
472dde0  ui_redesign Phase 1: tokens + primitives
db013de  ui_redesign Phase 2: desktop home + global TopBar
4e53dae  fix(home): card action buttons no longer navigate to project
1d56562  fix(api/projects): doneCount now includes archived tasks
a067332  fix(sw): unregister stale prod SW + clear caches in dev mode
e860612  ui_redesign Phase 3: per-project shell + Now view
1ab579a  ui_redesign Phase 4: re-skin core modals
730ac40  ui_redesign Phase 5: mobile bottom tab bar + /inbox
3e168e3  fix: project card click + mobile tab bar desktop visibility
03c439d  fix(sw): replace caching SW with self-uninstaller
f300f92  fix(next.config): drop immutable Cache-Control on /_next/static in dev
668b668  ui_redesign Phase 4 polish: shared ModalShell primitive
```

### Phase 1 — tokens + primitives

- Full oklch token system in `app/globals.css` (bg/fg/line/red/mint/amber/rose/sky/violet
  with `-tint` variants), light + dark themes, `@theme inline` Tailwind mapping.
- Inter (body) + JetBrains Mono (tabular) wired via `next/font/google`.
- Utility classes: `.eyebrow`, `.dot`, `.chip`, `.btn`, `.card-rd`, `.pipeline`,
  `.input-rd`, `.spark`, `.kbd`, `.safe-top`/`.safe-bottom`.
- `components/redesign/{icon,logo,phases,phase-pipeline,spark}.tsx`.

### Phase 2 — desktop home + global TopBar

- TopBar: Logo + "Control Tower / on RedEye" + activity link + notification bell
  (preserves `data-testid="notification-bell"`) + ThemeToggle.
- Wired into `client-providers.tsx` — replaces the legacy header.
- New home dashboard with FleetSummary, federated InboxCard, project
  filter chips, ProjectCardNew grid.
- New global pages: `/activity`, plus the `/api/{inbox,activity,projects}` enrichments.
- `ProjectWithStatus` gained `taskId`, `taskTitle`, `backlogCount`, `doneCount`,
  `scheduleEnabled`, `scheduleSummary`. Additive — older callers unaffected.

### Phase 3 — per-project shell + Now view

- `ProjectShell`: project bar (back link · status dot · name · path) +
  3-tab nav (Now / Tasks / History). Replaces the 6-tab `ProjectNav`.
  Tasks badge reads `backlogCount` from `/api/projects/[id]`.
- `now-client.tsx`: hero working-on card with PhasePipeline, questions
  banner, up next + recently shipped, live transcript pointer; right
  rail with Controls / Schedule / Health cards. Cost tracking, phase
  notifications, keyboard shortcuts all preserved.
- `mission-control-client.tsx` deleted (no longer routed).
- Tasks/History clients had their `<PageHeader>` stripped to avoid double
  headers under the new shell. **Their internals are still legacy
  styling** — see "Pending" below.

### Phase 4 — re-skinned core modals

- Five Radix-Dialog modals refactored to use the shared `ModalShell`
  primitive (header pill + title/subtitle, body, footer with hint slot,
  oklch backdrop blur, stronger shadow):
  - `answer-modal` (amber `q` pill)
  - `add-project-dialog` (sky `folder` pill)
  - `add-task-dialog` (mint `plus` pill, collapsible details)
  - `steer-dialog` (violet `steer` pill)
  - `add-schedule-dialog` (red `schedule` pill, frequency presets)

### Phase 5 — mobile shell

- `mobile-tab-bar.tsx` — sticky bottom bar, `.mobile-only` (md:hidden).
  Tabs: Home / Inbox (global) / Live (project-scoped) / Settings (greyed).
- `app/inbox/{page,inbox-client}.tsx` — global federated question feed.
- `globals.css`: `.mobile-only` / `.desktop-only` at the Tailwind `md`
  breakpoint, plus body bottom-padding for safe-area-inset-bottom.
- Responsive collapse on FleetSummary and the Now-view 2-col layout.

## Loose ends — what to do next

### Modal polish — verification

The Phase 4 polish commit (668b668) introduced `ModalShell` and refactored
all five modals. **Visual verification in the live browser is incomplete**:
during the work session the Playwright runs were showing the *previous*
modal markup despite a server restart and `.next/` purge. Likely the
Playwright session was caching its compiled page; reopening Playwright
fresh should fix it. Acceptance check:

```
open http://127.0.0.1:3200/project/1
# click "Add schedule" → modal should show:
#   - tinted red icon-pill at top-left of header
#   - title "Add a schedule" beside the pill (NOT as an eyebrow)
#   - frequency preset chips ("Every 4h" / "Daily" / "Weekdays · 9pm" / "Weekly")
#   - footer with "Appended to .redeye/schedules.md" hint on the left
```

If the modal still shows a top eyebrow row "NEW SCHEDULE", clear browser
caches and reload.

### Phase 6 — cleanup + e2e

Pending items:

- [ ] Visual confirmation of all five polished modals (see above).
- [ ] Delete `components/project-nav.tsx` — no longer used by any route
      (verified: only its own tests + the responsive smoke test reference it).
- [ ] Decide whether `app/project/[id]/{steer,live,schedules}` URL-routes
      stay (they're orphans in the nav but still resolve by URL — Now view
      links Steer modal, Schedule modal, and Live page from the right rail
      / transcript card). Option A: leave as fallback. Option B: redirect to
      the modal trigger.
- [ ] Re-skin Tasks-tab and History-tab internals. Their page-level headers
      were stripped (so the shell isn't doubled up) but the body cards are
      still the legacy styling. The simplest path is to map the existing
      task-row + session-history-row components onto `.card-rd` / oklch
      tokens, or replace them with new redesign components.
- [ ] Re-skin or replace `home-onboarding-wizard` and `onboarding-wizard`
      (large multi-step flows, ~370 + ~490 lines). The user has 3 projects
      already so the home wizard isn't visible during dogfooding.
- [ ] Wire the `/_next/static` immutable Cache-Control flag back on for
      production-only (the gate is in `next.config.ts:79-85` —
      `skipImmutableCache = isDev && !isViteTest`).
- [ ] Optionally re-introduce the prod-mode service worker once we have
      a versioned cache key (`ct-shell-v2`) — `public/sw.js` currently
      ships as a one-shot self-uninstaller (commit 03c439d).
- [ ] Run the full Playwright suite against `npm run build && npm start`
      (`npm run e2e`). The new `e2e/ui-redesign-smoke.spec.ts` is in place
      but hasn't been run end-to-end against a prod build yet.

### HazeV2 — end-to-end dogfood

Not started. Original brief:

> Create `/Users/casa/HazeV2` (a fresh folder), register and onboard
> via the UI. Then via the UI, build HazeV2 — a CLI tool that:
>   - tells you the weather in nice ASCII art
>   - finds the best weather around your location given a max
>     driving-hours CLI arg.
> Add at least 20 tasks via the UI, add some steering directives, add a
> security review as a schedule and run it.
> Monitor the entire flow until it finishes. Use directives to adjust
> behaviours (e.g. require e2e testing) as it goes — keep dogfooding
> HazeV2 yourself to identify steering opportunities. Use background
> monitors / sub-agents as needed.
> Keep using Playwright to validate the UI matches the design. Fix any
> design issue directly.

Resume plan when you come back to this:

1. Confirm modal polish is visually correct (above).
2. `mkdir /Users/casa/HazeV2 && cd /Users/casa/HazeV2 && git init`.
3. Drive the home page → Add project dialog with the new path.
4. Use the OnboardingWizard (legacy UI for now) to scaffold `.redeye/`.
5. From the Now view, Add task ×20 with the HazeV2 acceptance criteria.
6. Open Steer and add 2–3 baseline directives ("require e2e tests
   before deploy", "ASCII art rendered with figlet", etc.).
7. Add a Security Review schedule and run it once.
8. Click Start session and watch via the live transcript pointer
   (`/project/N/live`) plus background `Monitor` on logs.
9. Iterate: add steering directives whenever the agent goes off-track.
10. End-to-end: dog-food the HazeV2 CLI yourself between phases.

## How to know if a build is healthy

```
npx tsc --noEmit
npm test                       # 1647/1647 passing as of 668b668
npm run build && npm start     # smoke-test prod build before merging
npm run e2e                    # Playwright against prod (port 3200)
```

## Pointers

- [`docs/redesign-source/README.md`](redesign-source/README.md) — design
  bundle handoff notes.
- [`docs/redesign-source/project/Control Tower Redesign.html`](redesign-source/project/Control%20Tower%20Redesign.html)
  — main canvas (open in a browser to see every artboard side-by-side).
- [`docs/redesign-source/project/app/`](redesign-source/project/app/) — JSX
  source for every redesign component (read-only; current implementation
  lives in `components/redesign/`).
- [`docs/redesign-source/project/ref/`](redesign-source/project/ref/) — 17
  reference screenshots from the design conversation.
- [`docs/redesign-source/chats/chat1.md`](redesign-source/chats/chat1.md)
  — full design conversation transcript with iterations.
- [`CLAUDE.md`](../CLAUDE.md) — repo orientation; UI Redesign section
  lists every primitive and endpoint added by the redesign.
