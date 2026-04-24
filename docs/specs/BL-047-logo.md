# BL-047 — Update Dashboard Logo

**Status:** planned  
**Priority:** P1  
**Type:** feature

---

## Context

The current header in `app/layout.tsx` (lines 35–40) renders a flat single-weight text
label:

```tsx
<span className="text-sm font-bold tracking-widest text-red-600 uppercase">
  Control Tower
</span>
```

This is already a text mark (no image asset). Q-006 was posted asking the CEO for logo
preferences; no response was received. Proceeding with the default: upgrade to a
split-weight "Control Tower" text mark in the existing red accent color, linked to `/`.

The `public/` directory contains default Next.js scaffold SVGs (`next.svg`, `vercel.svg`,
`file.svg`, `globe.svg`, `window.svg`). None are referenced anywhere in the application
code — they can be left in place or removed as a cleanup step.

No project-level layout (`app/project/[id]/layout.tsx`) contains a logo or nav header —
only the root layout needs to change.

---

## Architecture Decision

**Decision:** Replace the flat `<span>` with a `<Link href="/">` wrapping a flex
container that stacks or flows two styled spans:
- "CONTROL" — small, wide-tracked, semi-bold
- "TOWER" — larger, black-weight

No image assets required. No new dependencies.

**Rejected alternatives:**
- SVG icon mark — requires an asset file or inline SVG; overkill for a text-primary brand
- Next.js `<Image>` — same reason, plus adds a dependency and file to maintain
- Single-line flat text — already exists; no visual upgrade

---

## Proposed JSX

```tsx
import Link from "next/link";

// Inside the <header> in app/layout.tsx, replace the existing <span>:
<Link
  href="/"
  aria-label="Control Tower — go to home"
  className="flex flex-col leading-none select-none"
>
  <span className="text-xs font-bold tracking-widest text-red-600 dark:text-red-500 uppercase">
    Control
  </span>
  <span className="text-lg font-black text-red-600 dark:text-red-500 uppercase leading-none">
    Tower
  </span>
</Link>
```

The link is `flex-col` so "CONTROL" sits as a small eyebrow above "TOWER". Both lines are
`uppercase` for a consistent all-caps mark feel. `leading-none` on the outer container
and inner `<span>` keeps them tight.

---

## Favicon

`app/favicon.ico` is the default Next.js favicon (blue-and-white N). It is not changed
in this iteration. Replacing it is out of scope for BL-047 — would require generating a
new icon asset (e.g. a red square or monogram). If needed, file a follow-up backlog item.

---

## Sub-tasks

### T1 — Implement split-weight text mark in root layout
- **File:** `app/layout.tsx`
- **Change:** Replace the `<span>` logo at line 36 with the `<Link>` + two-span structure
  above. Add `import Link from "next/link"` at the top if not already imported.
- **Size:** S
- **Dependencies:** none
- **Agent type:** Dev (generic)
- **Test strategy:** Unit test via `components/theme-toggle.test.tsx` pattern or a new
  `app/layout.test.tsx` that renders the layout and asserts:
  - A link with `href="/"` and `aria-label` containing "Control Tower" is present
  - Two spans with text "Control" and "Tower" are rendered
  - Both spans carry `text-red-600` class
- **Acceptance criteria:**
  - Header contains a `<a href="/">` (rendered by `<Link>`) wrapping the two-span mark
  - "CONTROL" renders in `text-xs font-bold tracking-widest`
  - "TOWER" renders in `text-lg font-black`
  - Both in `text-red-600 dark:text-red-500`
  - Clicking the mark from any page navigates to `/`
  - Light and dark mode both look correct (Playwright screenshot)
- **Status:** done

### T2 — Remove or note unused default Next.js SVGs in public/
- **Files:** `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/globe.svg`,
  `public/window.svg`
- **Change:** Delete the five scaffold SVGs — they are not referenced in app code and
  serve no purpose. This is a cleanup step.
- **Size:** S
- **Dependencies:** T1 (confirm none are newly referenced after T1)
- **Agent type:** Dev (generic)
- **Test strategy:** After deletion, run `npx vitest run` to confirm no test imports them.
  Run `NODE_ENV=production npm run build` to confirm build succeeds.
- **Acceptance criteria:**
  - `public/` no longer contains the five default Next.js SVGs
  - Build passes clean with no missing-file errors
  - No grep hits for `next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` in
    `app/` or `components/`
- **Status:** done

### T3 — Unit tests for logo mark
- **File:** `app/layout.test.tsx` (new)
- **Size:** S
- **Dependencies:** T1
- **Agent type:** Dev (generic)
- **Test strategy:** Render `<RootLayout>` with vitest + React Testing Library. Assert:
  - `screen.getByRole("link", { name: /control tower/i })` resolves
  - Link `href` is `"/"`
  - "Control" and "Tower" text nodes are present inside the link
  - Each span has the `text-red-600` class
- **Acceptance criteria:**
  - All new tests pass under `npx vitest run`
  - No existing tests broken
- **Status:** done

---

## Acceptance Criteria (feature-level)

1. The root layout header shows "CONTROL" (small) above "TOWER" (large) in red, linked to `/`
2. The mark is visually distinct from the flat single-line predecessor
3. Both light mode (`bg-gray-50`) and dark mode (`bg-zinc-950`) look correct
4. Playwright screenshot confirms the mark renders on the home page and a project page
5. Build (`NODE_ENV=production npm run build`) passes clean
6. Full unit test suite (`npx vitest run`) passes

---

## Questions

None. Q-006 has been open without CEO response; proceeding with confirmed default (option c).
