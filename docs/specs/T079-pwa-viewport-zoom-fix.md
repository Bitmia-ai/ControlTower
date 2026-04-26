# T079 — PWA auto-zooms when typing on phone

**Status:** pending  
**Type:** fix  
**Priority:** P1  
**Iteration:** 109  

---

## Problem

On iOS and Android PWA installs (and mobile browsers), the browser auto-zooms the viewport when the user taps an input field. This is the default browser behaviour triggered when an `<input>` or `<textarea>` has an effective `font-size` smaller than ~16px, or when `maximum-scale` is absent from the viewport meta tag.

The current `viewport` export in `app/layout.tsx` only sets:

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};
```

Missing `maximumScale: 1` (and `userScalable: false`) allows the browser to zoom in on input focus, which breaks the PWA layout and forces the user to manually zoom back out after each keystroke.

---

## Architecture Decision

Next.js 15 uses the typed `Viewport` export — not a raw `<meta>` tag — to emit the viewport meta. The `Viewport` type (from `next`) accepts:

- `maximumScale: number` → emits `maximum-scale=1`
- `userScalable: false` → emits `user-scalable=no`

Adding both to the existing `viewport` constant in `app/layout.tsx` is the complete fix. No new files, no new dependencies, no routing changes.

**Trade-off note:** `user-scalable=no` prevents manual pinch-to-zoom for accessibility (WCAG 1.4.4). The CEO's explicit request is to stop the auto-zoom nuisance in a dashboard PWA used by developers, not a public-facing site. The app already carries `robots: noindex`. Accepted.

---

## Sub-task Decomposition

### T1 — Fix viewport export (S)
- **File:** `app/layout.tsx`
- **Change:** Add `maximumScale: 1` and `userScalable: false` to the `viewport` constant.
- **Dependencies:** none
- **Agent:** Dev (generic)
- **Test strategy:** Update the existing `"exports viewport with device-width and initialScale 1"` unit test in `app/layout.test.tsx` to also assert `maximumScale === 1` and `userScalable === false`.
- **Acceptance criteria:**
  - `viewport` object contains `{ width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false }`
  - `npm run build` emits `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">` in the HTML `<head>`
  - All 804 existing tests still pass; the updated layout test passes
- **Status:** pending

### T2 — Verify emitted HTML (S)
- **Change:** After build, run `NODE_ENV=production npm run build` and confirm the viewport meta string in `.next/server/app/index.html` or equivalent SSR output.
- **Dependencies:** T1
- **Agent:** Dev (generic) / build verification step
- **Test strategy:** `grep` the built output for `maximum-scale=1` as a smoke check inside the DEPLOY step.
- **Acceptance criteria:**
  - Built HTML contains `maximum-scale=1, user-scalable=no`
- **Status:** pending

---

## Test Plan

| Layer | What | File |
|-------|------|------|
| Unit | `viewport` export shape asserts `maximumScale` and `userScalable` | `app/layout.test.tsx` (update existing test) |
| Build smoke | grep built HTML for `maximum-scale=1` | manual in DEPLOY |

No new test files required. The existing layout test is the right home for the assertion.

---

## Questions for CEO

None — the fix is fully specified by the task description. No ambiguity.

---

## Sizing Summary

| Sub-task | Size | Agent |
|----------|------|-------|
| T1 Viewport fix + test update | S | Dev |
| T2 Build smoke | S | Dev |

Total: 2 × S
