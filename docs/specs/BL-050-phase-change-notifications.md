# BL-050: In-app Notification Toast for RedEye Phase Changes

## Overview

Users have no awareness when RedEye transitions between phases (BUILD, REVIEW, DEPLOY, DONE/MERGE)
without watching the dashboard constantly. This feature adds a dual-channel notification system:

1. **Browser Notification API** — native OS-level push notification if permission granted.
2. **In-app toast overlay** — fallback (or complement) rendered inside the dashboard when the
   browser tab is open.

When the mission control 5-second polling loop detects a phase change, both channels are triggered
appropriately. Clicking a toast navigates to the Live tab for that project.

---

## Architecture Decisions

### AD-1: Phase-change detection via the existing 5-second poll

The mission control page (`app/project/[id]/page.tsx`) already polls `GET /api/projects/[id]`
every 5 seconds and has a `detail.state?.phase` value. Exactly like the task-transition tracker
(`useTaskTransitionTracker`), we will create a parallel hook `usePhaseChangeNotifier` in
`lib/use-phase-change-notifier.ts` that watches `phase` (and optionally `backlog_item`) across
renders and fires a callback when a genuine transition is detected.

**Why a dedicated hook rather than inline logic?**
- Matches the `useTaskTransitionTracker` pattern already established in the codebase.
- Isolatable, testable in vitest without rendering the full page.
- Can be unit-tested with `renderHook` — identical approach to the existing test file.

### AD-2: Notification logic lives in a `usePhaseNotifications` hook

A second hook, `usePhaseNotifications`, handles:
- Requesting browser Notification API permission (idempotent — checks `Notification.permission`
  before calling `requestPermission()`).
- Firing a `new Notification(...)` when permission is granted.
- Firing an in-app toast via a toast context otherwise (or always, as a secondary channel).
- Providing a `requestPermission()` helper to be called on first user interaction.

This separation keeps side-effect logic out of the component layer and makes mocking straightforward.

### AD-3: In-app toast is a standalone UI component with no new dependencies

No external toast library (no `react-hot-toast`, no `sonner`). The codebase has zero toast
infrastructure today. We implement a minimal `<ToastContainer>` component using Tailwind
(`fixed bottom-4 right-4 z-50 flex flex-col gap-2`) and a React context provider
`ToastProvider` that exposes `showToast(message, href?)`.

Each toast:
- Auto-dismisses after 5 seconds via `useEffect` + `setTimeout`.
- Is dismissible via an `×` button.
- If `href` is provided, clicking the toast body navigates via `router.push(href)`.
- Respects dark/light mode via Tailwind `dark:` classes.

`ToastProvider` is mounted once in `app/layout.tsx` alongside `ThemeProvider`, giving it
app-wide scope without prop-drilling.

### AD-4: Phase notifications fire only for specific phases

Notify on transitions **into** these phases:
- `BUILD` — "RedEye entered BUILD phase — working on {backlog_title}"
- `REVIEW` — "RedEye entered REVIEW phase — {backlog_title}"
- `DEPLOY` — "RedEye entered DEPLOY phase"
- `MERGE` / `VERIFY` — treated as "DONE" signal: "RedEye completed {backlog_title}"
- `STABILIZE` — "RedEye entered STABILIZE — environment broken"

Phases NOT notified: `TRIAGE`, `PLAN`, `HARDEN`, `INCORPORATE`, `SCHEDULES`, `VERIFY`
(too low-signal or intermediate). This list is a `const` set defined in the hook so it can be
easily adjusted.

### AD-5: Skip notification on first mount

On first render, the hook must NOT fire a notification for the current phase (which is just the
state when the user opened the page). Only genuine poll-detected transitions after the first
observation should fire. This mirrors the `useTaskTransitionTracker` `undefined` sentinel pattern.

### AD-6: Notification permission is requested on first user interaction

Browser best practices prohibit calling `Notification.requestPermission()` without a user gesture.
We wrap permission request inside the `onStart` callback of ControlsCard (or any button click in
the page). Specifically, a `useEffect` in `usePhaseNotifications` adds a one-time `click`
listener on `document` that calls `requestPermission()` on first click, then removes itself.
This is the most unobtrusive approach — permission prompt appears the first time the user clicks
anything on the mission control page.

### AD-7: No new npm dependencies

The feature is implemented entirely with:
- React (already present): context, hooks, portals
- Tailwind CSS (already present): toast styling
- Browser native Notification API (no polyfill needed — Control Tower is a local-only tool)

---

## Sub-task Decomposition

### T1 — `lib/use-phase-change-notifier.ts` (new hook)

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** none
**Description:**

Create `usePhaseChangeNotifier(phase, backlog_title, onPhaseChange)`:
- Maintains a `prevPhaseRef` (initial `undefined` sentinel — same pattern as `useTaskTransitionTracker`).
- On each render where `phase` is defined: if previous is `undefined`, record phase but do NOT fire.
  If previous is defined and `phase !== previous`, call `onPhaseChange(phase, backlog_title)`.
- Callback is held in a ref to avoid stale closure issues.

**Test strategy:** Unit tests in `lib/use-phase-change-notifier.test.ts` using `renderHook`:
- First render with a phase: no callback fires.
- Same phase on re-render: no fire.
- Phase change PLAN → BUILD: fires with correct args.
- Phase change to same phase value: no double-fire.
- Callback update across renders: always invokes latest function (ref stability test).

**Acceptance criteria:**
- [x] Hook exported from `lib/use-phase-change-notifier.ts`
- [x] 5+ unit tests, all passing
- [x] TypeScript strict — no `any`

**Status:** done

---

### T2 — `lib/use-phase-notifications.ts` (new hook, notification dispatch)

**Size:** M
**Agent type:** Dev (generic)
**Dependencies:** T1 (consumes `usePhaseChangeNotifier` internally)
**Description:**

Create `usePhaseNotifications(phase, backlog_title, projectId)`:
- Internally calls `usePhaseChangeNotifier` with a handler that:
  1. Checks if the new phase is in `NOTIFIABLE_PHASES`.
  2. Composes a message string (see AD-4 for per-phase text).
  3. Computes `href = /project/${projectId}/live`.
  4. Calls `showToast(message, href)` from `ToastContext` (AD-3).
  5. If `Notification.permission === "granted"`, also fires a native `new Notification(...)`.
- Registers a one-time `document` click listener for permission request (AD-6). Cleans up on
  unmount.
- Exposes `{ notificationsEnabled, requestPermission }` for the UI to optionally render a
  permission-request banner.

**Test strategy:** Unit tests in `lib/use-phase-notifications.test.ts`:
- Mock `window.Notification` constructor and `Notification.permission`.
- Mock `showToast` via mocked context.
- Assert: BUILD transition calls `showToast` with correct message.
- Assert: TRIAGE transition does NOT call `showToast`.
- Assert: when `Notification.permission === "granted"`, `new Notification(...)` is called.
- Assert: when permission is `"denied"`, `new Notification(...)` is NOT called.
- Assert: cleanup removes the document click listener.

**Acceptance criteria:**
- [x] Hook exported from `lib/use-phase-notifications.ts`
- [x] `NOTIFIABLE_PHASES` exported as `const` Set for testability
- [x] 6+ unit tests, all passing
- [x] No toast fires on first mount
- [x] Notification permission request fires only on first document click

**Status:** done

---

### T3 — `components/toast-provider.tsx` + `components/toast-container.tsx` (new UI)

**Size:** M
**Agent type:** Dev (generic)
**Dependencies:** none (T2 depends on this, so implement first)
**Description:**

Implement in-app toast infrastructure:

**`ToastContext`** (`components/toast-provider.tsx`):
```ts
interface Toast {
  id: string;          // nanoid or Date.now().toString()
  message: string;
  href?: string;
  duration?: number;   // ms, default 5000
}
interface ToastContextValue {
  showToast: (message: string, href?: string, duration?: number) => void;
}
```

**`ToastProvider`** wraps children, manages `toasts: Toast[]` state with `addToast` / `removeToast`.

**`ToastContainer`** (`components/toast-container.tsx`):
- `fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none`
- Each toast item: `pointer-events-auto`, dark/light themed card, message text, dismiss button.
- Auto-dismiss via `useEffect(() => { const t = setTimeout(dismiss, duration); return () => clearTimeout(t); }, [id])`.
- If `href` provided, entire card body is a Next.js `<Link>` for navigation.
- Smooth enter/exit animation via Tailwind `transition-all`.

**Test strategy:** Unit tests in `components/toast-provider.test.tsx`:
- Render `ToastProvider` with a consumer that calls `showToast`.
- Assert toast appears in DOM.
- Assert toast disappears after duration (use fake timers via `vi.useFakeTimers()`).
- Assert dismiss button removes toast immediately.
- Assert that toast with `href` renders a link.

**Acceptance criteria:**
- [x] `ToastProvider` and `useToast` hook exported from `components/toast-provider.tsx`
- [x] `ToastContainer` renders inside `ToastProvider`
- [x] Auto-dismiss at 5 seconds (configurable)
- [x] `×` dismiss button
- [x] Correct dark/light mode classes
- [x] 4+ unit tests passing

**Status:** done

---

### T4 — Wire `ToastProvider` into `app/layout.tsx`

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** T3
**Description:**

Import `ToastProvider` and wrap `{children}` alongside `ThemeProvider` in `app/layout.tsx`.
The nesting order: `ThemeProvider > ToastProvider > children`.

Since `ToastProvider` renders `ToastContainer` internally (via a portal or at its own root),
no additional changes to the layout JSX beyond the provider wrapping are needed.

**Test strategy:** Verify via existing Playwright smoke tests that the layout still renders
correctly and no hydration errors appear. Update the layout unit test (if present) to assert
that `ToastProvider` is in the component tree.

**Acceptance criteria:**
- [ ] `ToastProvider` wrapping `children` in `app/layout.tsx`
- [ ] `npm run build` passes (no hydration/SSR errors)
- [ ] No regressions in existing unit tests

**Status:** pending

---

### T5 — Wire `usePhaseNotifications` into `app/project/[id]/page.tsx`

**Size:** S
**Agent type:** Dev (generic)
**Dependencies:** T1, T2, T3, T4
**Description:**

In `app/project/[id]/page.tsx`:
- Import and call `usePhaseNotifications(phase, backlogTitle, projectId)` where:
  - `phase = detail?.state?.phase ?? null`
  - `backlogTitle = detail?.state?.backlog_title ?? null`
- No additional JSX changes needed — the toast appears via the global `ToastContainer`.
- Optionally render a small notification-permission hint in the `ControlsCard` area if
  `notificationsEnabled === false && Notification.permission === "default"` — this is
  low-priority and guarded behind the `notificationsEnabled` flag from the hook.

**Test strategy:**
- Extend `app/project/[id]/page.tsx`'s test file (or create one) with a test that:
  - Mocks `GET /api/projects/${id}` to return a state with phase `TRIAGE`.
  - Re-renders (polls) with phase changed to `BUILD`.
  - Asserts that the toast message "RedEye entered BUILD phase" appears in the DOM.
- This is the integration test that ties the full chain together.

**Acceptance criteria:**
- [ ] `usePhaseNotifications` called in page with correct args
- [ ] Toast appears in DOM when phase changes to a notifiable phase in test
- [ ] No toast on initial render
- [ ] `npm run build` still passes

**Status:** pending

---

### T6 — Unit tests for full notification chain + build verification

**Size:** S
**Agent type:** QA Lead
**Dependencies:** T1 through T5
**Description:**

Final quality pass:
1. Run `npx vitest run` — all tests must pass.
2. Run `NODE_ENV=production npm run build` — must complete without error.
3. Review test coverage for the new hooks and components:
   - `lib/use-phase-change-notifier.test.ts` — 5+ tests
   - `lib/use-phase-notifications.test.ts` — 6+ tests
   - `components/toast-provider.test.tsx` — 4+ tests
   - Integration test in `app/project/[id]/` — 1+ test
4. If any test gaps found, write them.
5. Check for TypeScript errors via `tsc --noEmit` (or build output).

**Acceptance criteria:**
- [ ] All existing tests continue to pass (no regressions)
- [ ] New test files cover all hooks and toast component
- [ ] Build passes
- [ ] No TypeScript errors

**Status:** pending

---

## File Manifest

| File | Action | Owner |
|------|--------|-------|
| `lib/use-phase-change-notifier.ts` | Create | T1 |
| `lib/use-phase-change-notifier.test.ts` | Create | T1 |
| `lib/use-phase-notifications.ts` | Create | T2 |
| `lib/use-phase-notifications.test.ts` | Create | T2 |
| `components/toast-provider.tsx` | Create | T3 |
| `components/toast-container.tsx` | Create | T3 |
| `components/toast-provider.test.tsx` | Create | T3 |
| `app/layout.tsx` | Modify | T4 |
| `app/project/[id]/page.tsx` | Modify | T5 |
| `app/project/[id]/page.test.tsx` | Create | T5 |

---

## Open Questions

None. All design choices above use safe defaults. See `.redeye/inbox.md` for any new questions
posted during planning.

---

## Acceptance Criteria (Feature-level)

- [ ] When mission-control poll detects phase → BUILD: toast appears with task title
- [ ] When mission-control poll detects phase → REVIEW: toast appears
- [ ] When mission-control poll detects phase → DEPLOY: toast appears
- [ ] When mission-control poll detects phase → MERGE/DONE: toast appears with "completed" message
- [ ] Clicking toast navigates to `/project/${id}/live`
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Toast has `×` dismiss button
- [ ] No toast fires when page first loads (no false-positive on mount)
- [ ] If `Notification.permission === "granted"`, a native OS notification also fires
- [ ] If `Notification.permission !== "granted"`, in-app toast still fires (no silent failure)
- [ ] Dark mode and light mode both look correct
- [ ] All unit tests pass
- [ ] `npm run build` passes
