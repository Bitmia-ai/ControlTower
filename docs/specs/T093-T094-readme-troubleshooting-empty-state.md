# Spec: T093 + T094 — README Troubleshooting Section + Empty-State UX

**Iteration:** 122  
**Priority:** P1 + P1  
**Type:** docs + feature

---

## T093: Troubleshooting Section in README

### Goal

Add a `## Troubleshooting` section to `README.md` covering the 6 issues listed in the task description. Each entry: 1 sentence symptom, 1 sentence cause, 1 line fix.

### Location

Insert the `## Troubleshooting` section between the `## FAQ` section and the `## Architecture` section in `README.md`.

### Content

1. **Port 3200 already in use**
   - Symptom: `npm run dev` fails with "address already in use :3200"
   - Cause: Another process is listening on port 3200
   - Fix: `lsof -ti:3200 | xargs kill -9` or use `npx next dev --webpack --port 4000`

2. **Tailscale serve needs prod mode**
   - Symptom: Home page shows "Loading projects…" forever when accessed via Tailscale
   - Cause: Next.js dev mode does not work behind Tailscale serve (upstream issue [tailscale/tailscale#18827](https://github.com/tailscale/tailscale/issues/18827))
   - Fix: Run `npm run build && npm start` (production mode) and re-run `tailscale serve 3200`

3. **`npm run build` fails with module-not-found**
   - Symptom: Build fails immediately with "Cannot find module '...'"
   - Cause: `node_modules` missing or incomplete
   - Fix: `npm install` then retry `npm run build`

4. **Home page shows "Loading projects" forever**
   - Symptom: Spinner stuck on localhost:3200 in dev mode; fine in production
   - Cause: Usually Tailscale in dev mode (see above) or middleware CSRF false positive blocking the GET /api/projects request
   - Fix: Check browser network tab for 403 — if present, verify `Origin` or `Sec-Fetch-Site` headers look right for localhost:3200

5. **Project page shows "Something went wrong"**
   - Symptom: Mission control page crashes after a self-dogfood DEPLOY
   - Cause: Stale `.next/` chunks — Control Tower rebuilt its own `.next/` while the prod server was reading from it (see T103 note in CLAUDE.md)
   - Fix: `npm run build && npm start` to get a fresh prod server with consistent chunks

6. **RedEye loop won't start**
   - Symptom: Clicking Start does nothing, or CTO exits immediately
   - Cause: The `~/redeye` plugin directory does not exist or the `claude` binary is not in PATH
   - Fix: Verify `which claude` works in your shell and that `~/redeye/plugin.json` exists; if not, re-install RedEye via `--plugin-dir ~/redeye`

### No new tests needed (pure docs)

---

## T094: Empty-State UX for First Run

### Goal

Improve the home page empty state that appears when no projects are registered (`projects.length === 0`). Current state shows a minimal "No projects yet" message. Target: friendly onboarding copy that explains what to do next.

### Current State

`home-client.tsx` renders `<EmptyState>` with:
```
icon: <span>~</span>
title: "No projects yet"
subtitle: "Add a project directory to start monitoring it with Control Tower."
action: { label: "Add your first project", onClick: () => setDialogOpen(true) }
```

The `EmptyState` component (`components/empty-state.tsx`) is generic and works well.

### Changes

#### 1. `app/home-client.tsx` — enrich the EmptyState invocation

Replace the current minimal props with richer onboarding copy:

```tsx
<EmptyState
  icon={<FolderOpen className="h-5 w-5" />}
  title="Welcome to Control Tower"
  subtitle={
    <>
      Add your first project — point it at a git repo that has{" "}
      <a
        href="https://github.com/Bitmia-ai/RedEye"
        target="_blank"
        rel="noopener noreferrer"
        className="text-red-500 hover:underline"
      >
        RedEye
      </a>{" "}
      installed, or run{" "}
      <code className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
        /redeye:init
      </code>{" "}
      in Claude Code to scaffold it. See the{" "}
      <a
        href="https://github.com/Bitmia-ai/ControlTower#quick-start"
        target="_blank"
        rel="noopener noreferrer"
        className="text-red-500 hover:underline"
      >
        Quick Start
      </a>{" "}
      for setup steps.
    </>
  }
  action={{ label: "Add your first project", onClick: () => setDialogOpen(true) }}
/>
```

#### 2. `components/empty-state.tsx` — allow ReactNode subtitle

The `subtitle` prop currently accepts `string`. Change it to `React.ReactNode` so it can render the JSX with links/code.

```typescript
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;  // was: string
  action?: { label: string; onClick: () => void; };
}
```

#### 3. New unit tests in `components/__tests__/empty-state-home.test.tsx`

Test cases (source-text strategy, no render):
1. EmptyState renders title
2. EmptyState renders subtitle text when string
3. EmptyState renders action button with correct label
4. EmptyState hides action button when action prop absent
5. Home empty state copy: verify "Welcome to Control Tower" text in home-client
6. Home empty state copy: verify Quick Start link target in home-client
7. Home empty state copy: verify "Add your first project" button label

### Sub-tasks

| ID | Size | Work |
|----|------|------|
| S1 | S | Update `EmptyState` component: subtitle → ReactNode |
| S2 | S | Update `home-client.tsx`: richer empty-state props with FolderOpen icon + onboarding copy |
| S3 | S | Write 7 unit tests in `empty-state-home.test.tsx` |

### Acceptance

- Home page with 0 projects shows "Welcome to Control Tower" heading
- Subtitle has clickable link to RedEye GitHub and to Quick Start
- Subtitle shows inline code `/redeye:init`
- "Add your first project" button opens AddProjectDialog
- Existing EmptyState usages (non-home pages) still work (subtitle still renders for strings since ReactNode ⊇ string)
- 885 + 7 = ~892 tests, all pre-existing pass, 7 new pass

### No breaking changes

`subtitle?: ReactNode` is backward-compatible — any existing `string` subtitle still works since `string` is a valid `ReactNode`.
