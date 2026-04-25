# BL-068: Polish Live Tab Visual Design

## Problem

The Live tab is the most-watched view in Control Tower — operators leave it open
to monitor the autonomous loop. But it lags behind the rest of the app
visually:

- **No standard page header** — every other page (Backlog, History, Schedules,
  Steer) gained the precision-instrument header in BL-071 (Control Tower
  eyebrow + h1 + subtitle + `border-b`); Live still drops users straight into
  the toolbar.
- **Card types are inconsistent.** ToolUseCard and ToolResultCard share the
  same gray treatment with only the inner label color differing. ThinkingCard
  is a heavy violet wash that competes with AssistantTextCard for visual
  weight when the AI's actual response is what should stand out.
- **No mono `CARD-LABEL` token.** The "tool call", "result", "Claude",
  "Thinking…" labels mix font weights and casing styles — none of them use
  the `font-mono uppercase tracking-[0.18em] text-[11px]` eyebrow established
  in BL-071.
- **AssistantTextCard label** — `Claude` is rendered as a plain red word; in
  the design system it should be a mono eyebrow.
- **`ResultCard` (session result)** has an uppercase tracking label but uses
  `text-xs` and inconsistent spacing vs. SectionHeader.
- **Sticky toolbar** has its own ad-hoc background (`bg-white/90`) and a
  hairline `border-b border-gray-100` instead of the `border-gray-200
  dark:border-zinc-800` token used everywhere else.

## Design Direction — "Precision Instrument: Stream View"

The Live transcript is a stream of *events*. Each event type has a job:

| Card | Job | Visual treatment |
| --- | --- | --- |
| `AssistantTextCard` | The AI's output — the **most important** thing on screen | White/zinc-900 panel, **prominent red `border-l-2`**, mono `CLAUDE` eyebrow, larger body text |
| `ToolUseCard` | A systematic action — tool call with inputs | Indigo accent (`border-l-2 border-l-indigo-500/60`), mono indigo tool name in header |
| `ToolResultCard` | The system's response — output of the previous action | Cyan accent (`border-l-2 border-l-cyan-500/40`), mono cyan tool name |
| `ThinkingCard` | The AI's *internal* reasoning — private, secondary | Violet **muted** (`border-l-2 border-l-violet-500/50` on a near-transparent violet wash, *not* a heavy panel), italic preview |
| `ResultCard` | Session boundary metadata — usage / cost | Neutral zinc panel, mono `SESSION RESULT` eyebrow, tabular-nums numbers |
| Session boundary | Page break between sessions | Already correct — minor token alignment only |

### Shared rules

1. **`CARD-LABEL` token** — every card eyebrow becomes
   `font-mono text-[10px] uppercase tracking-[0.18em]` in the appropriate
   accent color (indigo-600/cyan-600/violet-600/red-600 in light;
   indigo-400/cyan-400/violet-400/red-400 in dark). Replaces the current
   ad-hoc `text-xs font-medium` and `text-xs font-mono` mixes.
2. **`border-l-2` left rail** replaces the current full-border-only treatment
   on tool cards. Same idiom as the active backlog item card. Cards keep their
   outer `border` for a defined edge but the colored `border-l-2` is the
   identity signal.
3. **Caret glyph** — `ChevronRight` (lucide) instead of unicode `▶`/`▼`,
   rotated via `transform rotate-90` when open. Matches the existing
   collapsible-section pattern.
4. **Toolbar tokens** — sticky toolbar `border-b` updated to
   `border-gray-200 dark:border-zinc-800`, matching every other top-of-page
   divider.

### Page header

Add the standard precision-instrument header **above** the sticky toolbar:

```tsx
<header className="pt-2 pb-5 mb-4 border-b border-gray-200 dark:border-zinc-800">
  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
    Control Tower
  </p>
  <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
    Live
  </h1>
  <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
    Real-time transcript of the autonomous loop
  </p>
</header>
```

The sticky toolbar moves *under* the header (still sticky to top:0 of viewport)
but no longer claims the role of being the page header.

## Files to Change

- `app/project/[id]/live/page.tsx` — add page header, refresh sticky-toolbar tokens
- `components/transcript-viewer.tsx` — apply new card treatments to `ToolUseCard`,
  `ToolResultCard`, `ThinkingCard`, `AssistantTextCard`, `ResultCard`, plus
  the fallback row
- `components/transcript-viewer.test.tsx` — keep all existing assertions green;
  the existing test already pins the `border-l-red-500` accent on
  AssistantTextCard, the italic preview span on ThinkingCard, and the literal
  text "Claude", "Thinking…", "tool call", "result", "New session" — those
  contracts must be preserved

## Sub-tasks

- **T1 (S) [done]:** Apply standard precision-instrument page header to
  `app/project/[id]/live/page.tsx`, plus refresh sticky-toolbar border tokens
  to match the rest of the app
- **T2 (M) [in-progress]:** Restyle the five card types in
  `components/transcript-viewer.tsx` per the table above — `border-l-2`
  identity rails, mono `CARD-LABEL` eyebrows in accent colors, replace
  unicode carets with `ChevronRight` rotation. Preserve every existing test
  assertion (label text strings, `.italic` preview span on ThinkingCard,
  `.border-l-red-500` on AssistantTextCard, `aria-label` / `aria-expanded`
  toggling, `whitespace-pre-wrap` body paragraph)

## Test Plan

- All 779 existing tests must remain green — especially the
  `transcript-viewer.test.tsx` suite, which pins behavioral and structural
  contracts that this redesign keeps
- `npm run build` must remain clean
- Manual visual check: each of the five card types renders with the new
  accent rail in both light and dark mode
