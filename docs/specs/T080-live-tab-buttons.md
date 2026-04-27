# T080: Live Tab Toolbar — Better Icons and Text Labels

## Problem

The Live tab sticky toolbar has three action buttons that are confusing:

1. **Expand all** — uses `ChevronsUpDown` icon (two chevrons pointing up and down)
2. **Collapse all** — uses `ChevronsUpDown rotate-180` (same icon rotated 180°, looks identical to expand)
3. **Auto-scroll toggle** — uses `ArrowDown` icon, no context about what it controls

Issues:
- The expand and collapse buttons use the same rotated icon — indistinguishable at a glance
- No text labels on any button — users must hover to see tooltips
- "Arrow down" doesn't convey the sticky-scroll-to-bottom concept clearly

## Solution

Replace the icon-only buttons with buttons that have both an icon and a short text label. Use distinct, unambiguous icons for each action. The buttons already have a good visual design (active state = red-600 fill) — preserve it.

### Button redesign

| Button | Old icon | New icon | Label |
|--------|----------|----------|-------|
| Expand all | `ChevronsUpDown` | `Maximize2` | "Expand all" |
| Collapse all | `ChevronsUpDown rotate-180` | `Minimize2` | "Collapse all" |
| Auto-scroll | `ArrowDown` | `ChevronsDown` (when on) / `ChevronsDown` (when off) | "Auto-scroll" |

For auto-scroll, the label changes based on state:
- When ON and at bottom: "Auto-scroll" (red active state)
- When ON but scrolled away: "Scroll down" (yellow active state)
- When OFF: "Auto-scroll" (gray inactive state)

The icon for auto-scroll should use `ChevronsDown` (double chevron pointing down) to convey "keep scrolling down" rather than just "go down once".

### Layout change

Change each button from `p-1.5` (icon-only padding) to `px-2.5 py-1.5 flex items-center gap-1.5 text-xs` to accommodate the text label alongside the icon.

The icon size stays at `w-3.5 h-3.5`.

## Files to change

1. `app/project/[id]/live/live-client.tsx` — update the three buttons in the toolbar

## Sub-tasks

### S1: Update expand-all button (S)
- Replace `ChevronsUpDown` icon with `Maximize2` from lucide-react
- Add "Expand all" text label
- Change padding from `p-1.5` to `px-2.5 py-1.5`
- Add `flex items-center gap-1.5 text-xs` classes

### S2: Update collapse-all button (S)
- Replace `ChevronsUpDown rotate-180` icon with `Minimize2` from lucide-react
- Add "Collapse all" text label
- Same padding/flex classes as S1

### S3: Update auto-scroll button (S)
- Replace `ArrowDown` icon with `ChevronsDown` from lucide-react
- Add "Auto-scroll" text label (static — don't change based on scroll state; the color/fill communicates state)
- Same padding/flex classes
- Keep the three-state color logic: active+at-bottom=red, active+scrolled-away=yellow, inactive=gray

### S4: Tests (S)
- Update `app/project/[id]/live/page.test.tsx` to:
  - Verify "Expand all" button text is rendered
  - Verify "Collapse all" button text is rendered
  - Verify "Auto-scroll" button text is rendered
  - Verify buttons still have correct aria-labels

## Test count estimate

~3–5 new/updated tests. Total impact: small. All changes are in one file.

## Non-goals

- No changes to button behavior or state logic
- No changes to icon size
- No changes to color/active-state logic
- No changes to the Reconnect or Clear buttons (they already have text)
