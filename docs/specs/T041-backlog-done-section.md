# T041: Done Tasks in a Separate Section in the Backlog Page — Redesign

## Overview

The backlog list page (`/project/[id]/backlog`) currently renders all items — in-progress, planned, and done — intermixed within their source sections (CEO Requests, Discovered, Triaged). Done items clutter the view and make it hard to focus on what's actionable. This feature separates done items into a collapsible "Done" section pinned at the bottom, collapsed by default, with a count badge in the header.

## Background

### Current rendering path

The backlog page (`app/project/[id]/backlog/page.tsx`) is a client component (`"use client"`). It fetches project detail from `GET /api/projects/[id]`, which returns a `ProjectDetail` shape containing:

- `activeItem: BacklogItem | null` — the currently in-progress item (from `state.json → backlog_item`)
- `upNext: BacklogItem[]` — planned/pending/in-progress items (all non-done, non-wontdo)
- `recentlyShipped: BacklogItem[]` — done items

The page merges `upNext` and `recentlyShipped` into `allItems`, then splits them by `item.section` (`"ceo"`, `"discovered"`, `"triaged"`, `"wontdo"`) and renders four `BacklogSection` components in a fixed order.

### The problem

Done items (`status === "done"`) are scattered across all four section buckets alongside planned and pending items. A project with 40+ done items (like the haze project) shows enormous lists of completed work that buries the upcoming actionable tasks.

### Key data shape

`BacklogItem` has:
- `id: string` — e.g. `"T041"`
- `title: string`
- `status: "pending" | "planned" | "in-progress" | "done" | "blocked" | "pending-triage"`
- `section: "ceo" | "discovered" | "triaged" | "wontdo"`
- `priority?: string`
- `type?: string`
- `cost_usd?: number`

All data is already in the client — no API changes are needed.

### No API changes needed

The `recentlyShipped` array already contains all done items. The `upNext` array contains all non-done items. Splitting and grouping is purely a client-side rendering concern inside `app/project/[id]/backlog/page.tsx`.

## Architecture Decisions

### AD-1: Status-based split, not section-based

Instead of grouping by `item.section` (CEO Requests / Discovered / Triaged) and then filtering done within each, the new layout groups first by **actionability**:

1. In Progress (active item hero card — unchanged)
2. Planned / Pending — all items where `status !== "done"` and `status !== "wont-do"`, in section order (ceo → discovered → triaged)
3. Done — all items where `status === "done"`, sorted newest-first by BL ID (descending numeric)
4. Won't Do — all items where `status === "wontdo"` in section, kept at the bottom (low-signal, rarely visited)

This matches the mental model: "what do I need to do?" (planned) vs "what's been done?" (done).

### AD-2: Collapsible "Done" section, collapsed by default

The Done section header acts as a toggle button. Collapsed state is the default so the page opens focused on planned work. The count badge in the header tells the user how many items are done without requiring expansion. Toggle state is local React state — no persistence needed.

### AD-3: Collapse state is local (no URL param, no localStorage)

The collapsed state resets on every page load. Persisting it adds complexity with minimal benefit. Users who want to see done items can expand with one click.

### AD-4: Designer agent creates the mockup first

Because this is a layout redesign (not just a bug fix), a designer agent (Gemini via the `gemini-worker` skill) must produce an HTML/CSS mockup of the Done section's visual design before the frontend agent implements it. The mockup must cover: collapsed state, expanded state, individual done item rows (with BL ID, title, cost badge, done pill), and the toggle button with count badge.

### AD-5: Section order within "Planned / Pending"

Within the Planned / Pending bucket, items are grouped by their original `section` in this order: CEO Requests, Discovered, Triaged. Section sub-headers are rendered only if that sub-section has items. This preserves the existing hierarchy for items that matter.

### AD-6: Won't Do section kept but de-emphasized

Won't Do items remain as a separate collapsible section (also collapsed by default) below Done. They are low-priority clutter but should remain accessible without a separate page.

## Sub-tasks

### T1: Designer — HTML mockup for the Done section layout
- **Size:** M
- **Dependencies:** none
- **Agent:** Designer (Gemini via `gemini-worker` skill)
- **Output:** A self-contained HTML file saved as `T041-backlog-done-section.html` under `docs/mockups/`
- **Design brief:**
  - The page has three visible sections when the Done section is collapsed:
    - "Currently Working On" hero card (existing green-border card — do not redesign)
    - "Planned / Pending" — sub-sections for CEO Requests / Discovered / Triaged showing actionable items with existing item-row styling
    - "Done (42)" — a collapsed toggle row with a chevron-down icon, count badge, and subtle background
  - When the Done toggle is clicked (expanded):
    - Chevron rotates to point up
    - Item rows appear below the header; each row shows: BL-ID badge (muted), title (link), cost badge (if cost_usd > 0), and a green "done" pill
    - Items are sorted newest first (descending BL number)
    - No section sub-headers inside Done (it is a flat list — the source section is irrelevant once done)
  - Design must support both dark mode (zinc-950 background, zinc-800 borders) and light mode (white background, gray-200 borders)
  - The toggle row uses: gray/muted background in collapsed state, no background in expanded state
  - Count badge: subtle gray pill showing the number, e.g. "42"
  - Won't Do section: same collapsible pattern as Done, collapsed by default, at the very bottom
  - Adhere to the existing typography and color system: `text-sm` item text, `text-xs` meta/badges, red accent (`#DC2626`) for hover links
- **Acceptance criteria:**
  - HTML file renders correctly in a browser with no external dependencies (inline styles or a CDN Tailwind link is fine)
  - Both collapsed and expanded states are visible in the mockup (e.g. Done collapsed at top, Done expanded further down)
  - Dark mode variant shown (CSS `prefers-color-scheme: dark` or a toggle in the mockup)
  - Mockup is self-contained and the frontend agent can implement directly from it
- **Status:** pending

### T2: Frontend — implement Done section in the backlog page
- **Size:** M
- **Dependencies:** T1 (mockup)
- **Agent:** Dev (generic)
- **File:** `app/project/[id]/backlog/page.tsx`
- **Changes:**
  1. Add local state: `const [doneOpen, setDoneOpen] = useState(false)` and `const [wontDoOpen, setWontDoOpen] = useState(false)`
  2. Compute item buckets from `allItems`:
     - `activeId` — unchanged (from `detail?.activeItem?.id`)
     - `plannedItems` — `allItems` filtered to `status !== "done"` and `section !== "wontdo"` and `id !== activeId`, then sorted by section order (ceo → discovered → triaged) and grouped for sub-section rendering
     - `doneItems` — `allItems` filtered to `status === "done"`, sorted descending by numeric BL ID
     - `wontDoItems` — `allItems` filtered to `section === "wontdo"`
  3. Replace the current `grouped` record and section map rendering with the new three-bucket layout:
     - Active hero card (unchanged)
     - Planned section: render sub-sections for CEO Requests / Discovered / Triaged using the existing `BacklogSection` component, but only for items in `plannedItems`
     - Done collapsible section: new `CollapsibleSection` component (see below) wrapping a flat `doneItems` list
     - Won't Do collapsible section: same pattern
  4. Add a `CollapsibleSection` component (can be in the same file or extracted to `components/collapsible-section.tsx`):
     ```tsx
     function CollapsibleSection({
       label,
       count,
       open,
       onToggle,
       children,
     }: {
       label: string;
       count: number;
       open: boolean;
       onToggle: () => void;
       children: React.ReactNode;
     })
     ```
     The header row is a `<button>` with: label text, count badge (`{count}`), and a chevron icon that rotates based on `open`. When `open`, `children` are rendered below.
  5. Done item rows inside the collapsible use the existing item-row JSX from `BacklogSection` (or a shared component). No status badge needed (everything is done). Show cost badge if `cost_usd > 0`.
- **Acceptance criteria:**
  - Backlog page opens with Done section collapsed by default
  - Clicking the Done header expands/collapses the list
  - Count badge shows correct number of done items
  - Done items sorted newest-first (descending BL number)
  - Planned items show in correct sub-sections (CEO Requests, Discovered, Triaged) with no done items mixed in
  - Won't Do section similarly collapsed at bottom
  - Dark and light mode render correctly
  - 10-second polling continues to work; toggling collapse state survives a poll cycle (React state is preserved between renders when data shape is unchanged)
- **Status:** done

### T3: Unit tests for section separation logic
- **Size:** S
- **Dependencies:** T2
- **Agent:** Dev (generic)
- **File:** New test file `app/project/[id]/backlog/page.test.tsx` (or extend the closest existing test)
- **Test cases:**
  1. Given `allItems` with a mix of planned and done items: `doneItems` contains only `status === "done"` items
  2. `plannedItems` contains no done items
  3. `doneItems` sorted descending by BL ID numeric value (T041 before T039)
  4. Active item excluded from both `plannedItems` and `doneItems`
  5. `CollapsibleSection` renders header with correct count badge
  6. `CollapsibleSection` renders children when `open=true`, hides when `open=false`
  7. Toggle button inverts `open` state on click
- **Test strategy:** vitest + React Testing Library. Mock `fetch` to return a `ProjectDetail` fixture. Assert DOM structure for each case.
- **Acceptance criteria:**
  - All 7 test cases pass
  - `npx vitest run` green (full suite)
- **Status:** done

### T4: E2E Playwright verification
- **Size:** S
- **Dependencies:** T2, T3
- **Agent:** Dev (generic) at VERIFY time
- **Verification approach:** Playwright MCP against `http://localhost:3200`
  1. Navigate to `/project/1/backlog` (haze project)
  2. Verify the Done section header is visible and collapsed (chevron pointing down, count badge showing)
  3. Verify no done items are visible in the main list
  4. Click the Done section header — verify it expands and done item rows appear
  5. Verify done items appear newest-first (highest BL number at top)
  6. Click again — verify it collapses
  7. Verify planned items (CEO Requests, etc.) remain visible throughout
  8. Take screenshots for record (dark mode and light mode)
- **Note:** Not an automated test file — Playwright MCP is used interactively at VERIFY time.
- **Acceptance criteria:** All 8 steps pass visually
- **Status:** pending

## Files Touched

| File | Change |
|------|--------|
| `app/project/[id]/backlog/page.tsx` | Restructure rendering: add `CollapsibleSection`, split items into planned/done/wontdo buckets, collapse Done by default |
| `components/collapsible-section.tsx` | Optional extraction — `CollapsibleSection` component (may stay inline in page.tsx if small enough) |
| `app/project/[id]/backlog/page.test.tsx` | New test file: section separation logic + `CollapsibleSection` behavior |
| `docs/mockups/` (HTML file, designer names it) | Designer mockup output (T1) |

## No Changes Required

- `app/api/projects/[id]/route.ts` — `recentlyShipped` already contains all done items; no new fields needed
- `app/api/projects/[id]/backlog/route.ts` — POST handler unchanged
- `lib/redeye-parsers.ts` — parsing logic unchanged; `status` field already captured correctly
- `lib/redeye-types.ts` — `BacklogItem` shape unchanged
- `lib/redeye-files.ts` — unchanged
- `lib/session-manager.ts` — unchanged

## Test Strategy Summary

- Unit tests (vitest): T3 adds ~7 targeted test cases in a new test file. Full suite must remain green.
- E2E: Playwright MCP at VERIFY time (T4).
- No changes to existing test files required (new component = new test file).

## Questions Posted

None. The approach is clear from the existing data shape: `recentlyShipped` maps to done items, `upNext` maps to planned items, no API changes needed. Toggle collapse state is local React state with no persistence.
