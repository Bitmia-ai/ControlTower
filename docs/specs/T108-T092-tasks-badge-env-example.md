# T108 + T092 — Tasks Count Badge + .env.example

## T108: Tasks tab — show count badge of open tasks

### Problem
The "Tasks" tab in `ProjectNav` has no visual indicator of how many open tasks are pending. Users must click into the tab to see the backlog count.

### Solution
Add a red pill badge next to the "Tasks" label showing the count of open tasks (status = pending or planned). Badge is hidden when count = 0. Updates live with the 5-second layout poll.

### What is "open"?
- Status `pending` OR `planned` — tasks awaiting or scheduled for work
- NOT `in-progress` (those belong in WorkingOn card)
- NOT `done`, `wontdo`, `blocked`, `pending-triage`

### Data flow
1. `app/project/[id]/layout.tsx` already polls `/api/projects/{id}` every 5s.
   - Response includes `data.upNext` (array of TaskItem with status pending/planned/in-progress).
   - Extract open count from `upNext`: `upNext.filter(i => i.status !== 'in-progress').length`.
   - Store as `openTaskCount` in layout state.
2. Pass `openTaskCount` as prop to `ProjectNav`.
3. `ProjectNav` renders badge inline with Tasks label.

### ProjectNav changes
- Add prop `openTaskCount?: number` to `ProjectNav`
- On the Tasks nav item, render badge when `openTaskCount > 0`:
  ```tsx
  {label === "Tasks" && openTaskCount > 0 && (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white min-w-[16px]">
      {openTaskCount}
    </span>
  )}
  ```
- Badge style: red pill (bg-red-600), white text, small font — matches home page question count badge.

### Layout changes
- Add `openTaskCount: number` to `ProjectInfo` state interface.
- In `fetchProject`: extract from `json.data.upNext`:
  ```ts
  const upNext: Array<{status: string}> = json.data?.upNext ?? [];
  openTaskCount: upNext.filter(i => i.status !== 'in-progress').length
  ```
- Pass `openTaskCount={project?.openTaskCount ?? 0}` to `<ProjectNav>`.

### Tests
New file: `components/__tests__/project-nav-badge.test.tsx`
- Badge renders when openTaskCount > 0
- Badge hidden when openTaskCount === 0
- Badge hidden when openTaskCount undefined
- Badge shows correct count number
- Badge position is inside Tasks link

---

## T092: Add .env.example

### Problem
CT reads 5 runtime env vars with no user-facing documentation.

### Solution
Create `.env.example` at repo root documenting all 5 vars. Reference from README Quick Start.

### Vars to document
```
# Path to the RedEye projects registry JSON file.
# Default: ~/.redeye/config.json
REDEYE_CONFIG_PATH=

# Path to the RedEye plugin directory (used for CLI invocation context).
# Default: ~/redeye
REDEYE_PLUGIN_DIR=

# Path to the Claude CLI binary.
# Default: claude (must be on PATH)
CLAUDE_BIN=

# Set to "1" to allow project paths outside $HOME (useful for monorepos or CI).
# Default: unset (only $HOME paths allowed)
ALLOW_OUTSIDE_HOME=

# The user's home directory. Normally set by the OS — do not override unless
# running in a container with a custom home.
# Default: (system-provided)
# HOME=
```

### README changes
Under Quick Start section, add one sentence referencing `.env.example`.

### Tests
No new tests needed — pure docs file. Existing build must remain clean.

---

## Sub-tasks

| ID | Size | Description |
|----|------|-------------|
| S1 | S | Add `openTaskCount` to layout state + pass to ProjectNav |
| S2 | S | Update ProjectNav to accept prop + render badge |
| S3 | S | Write `project-nav-badge.test.tsx` with 5 test cases |
| S4 | S | Create `.env.example` + update README Quick Start |

## Acceptance Criteria
- Open project with N pending tasks → Tasks tab shows red pill with N
- Mark one task done → badge decrements on next 5s poll
- 0 pending tasks → badge hidden (no empty pill)
- Build clean, 870 tests unchanged, 0 regressions
