# T075: Performance Audit — Bundle Size, Core Web Vitals, and Quick Wins

**Status:** planned  
**Priority:** P1  
**Source:** Q-012 default (iteration 106)

---

## Goal

Run a comprehensive performance audit of the Control Tower dashboard. Measure bundle sizes, identify heavy chunks, and implement the highest-impact quick wins. Deliver a markdown performance report documenting baseline metrics and improvements made.

---

## Context

Control Tower is a local-only Next.js 16 / React 19 dashboard (Turbopack, App Router). It binds to `127.0.0.1:3200` — it is not public-facing, so SEO and network latency are secondary concerns. The primary goals are:

- Fast **Time to Interactive (TTI)** — the dashboard should be snappy even while the claude process is running
- Small **JavaScript bundle** — less JS = fewer parse/compile cycles = faster subsequent navigations
- Correct **cache headers** on static assets — the Next.js dev server sets these automatically, but we should verify the production pattern is correct

### Current baseline (from `.next/static/` inventory, iter 106)

| Metric | Value |
|--------|-------|
| Total static JS (uncompressed) | ~1.2 MB across 26 chunks |
| Largest JS chunk | 228 KB |
| CSS bundle | 108 KB |
| react-markdown used in | 3 pages (steer, backlog detail, history) |
| `force-dynamic` on root layout | Yes — prevents Next.js prerendering |

---

## Tasks

### T1 — Implement dynamic imports for react-markdown (S)

**Why:** `react-markdown` + `remark-gfm` are imported synchronously in three client-side pages. Because these pages all use `'use client'`, the markdown library is loaded eagerly on first navigation to any of those tabs — even if the user never views the rendered content. Dynamic import moves it into a separate chunk that is only fetched when the component actually renders.

**Files to change:**

1. `app/project/[id]/steer/page.tsx` — replace `import ReactMarkdown from "react-markdown"` with `dynamic(() => import("react-markdown"), { ssr: false })` pattern
2. `app/project/[id]/backlog/[taskId]/page.tsx` — same dynamic import for ReactMarkdown
3. `app/project/[id]/history/page.tsx` — same dynamic import for ReactMarkdown

**Implementation pattern:**

```tsx
// Replace static import:
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";

// With a thin wrapper using next/dynamic:
import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => <span className="text-muted animate-pulse">…</span>,
});
```

Note: `remark-gfm` is still imported statically as it's tiny and needed to pass as a plugin array. Only `react-markdown` default export is the large chunk.

**Expected outcome:** `react-markdown` moves from being bundled into the shared chunk into a lazy-loaded route chunk. Pages that don't use it (home, mission control, live, schedules) stop paying the parse cost.

### T2 — Add viewport metadata and SEO basics to root layout (S)

**Why:** Next.js 15+ recommends exporting `viewport` separately from `metadata`. Currently the root layout has no explicit viewport config, which means the browser-default (desktop zoom on mobile) applies. While Control Tower is primarily desktop, the mobile-responsive work (T057) deserves the correct viewport tag.

**File to change:** `app/layout.tsx`

Add:
```tsx
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Control Tower",
    template: "%s | Control Tower",
  },
  description: "RedEye autonomous dev agent dashboard — monitor and manage AI coding sessions",
  robots: { index: false, follow: false }, // local-only tool, no public indexing
};
```

**Expected outcome:** Correct viewport meta tag, prevents mobile zoom issues, improves Lighthouse "Best Practices" score.

### T3 — Add HTTP cache headers for static assets in next.config.ts (S)

**Why:** By default, Next.js sets `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/` assets via its own handler. However, the `serverExternalPackages` configuration in our `next.config.ts` may affect this. Verify and explicitly configure headers to ensure:

- `/_next/static/*` — `max-age=31536000, immutable` (content-addressed, safe to cache forever)
- `/api/*` — `no-store` (always dynamic)

**File to change:** `next.config.ts`

Add a `headers()` async function:
```ts
async headers() {
  return [
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, no-cache",
        },
      ],
    },
  ];
},
```

**Expected outcome:** Correct long-lived caching on content-addressed assets, no-cache on API routes.

### T4 — Write performance audit report (S)

**File:** `docs/performance-audit.md`

Document:
- Baseline bundle inventory (from current `.next/static/` filesystem scan)
- Changes made in T1–T3 and their expected/measured impact
- Post-change bundle sizes (rebuild after T1–T3)
- Recommendations for future iterations (e.g. if bundle grows, areas to investigate)

### T5 — Tests (S)

Add unit tests verifying:
- Root layout exports both `metadata` and `viewport` with the correct fields (import and assert on the exported objects)
- `next.config.ts` exports a `headers` async function that returns the expected routes

**Test file:** `app/layout.test.tsx` (already exists — add assertions)
**Test file:** `next.config.test.ts` (new — 3 tests: headers returns array, static path has immutable header, api path has no-store header)

---

## Out of Scope

- Lighthouse CLI run (requires running server — document how to run it manually in the report)
- Bundle analyzer HTML report (requires `@next/bundle-analyzer` install — out of scope to add new deps)
- Image optimization (no `<img>` tags — Next.js Image component not used; SVGs are inline)
- Service worker / offline mode (scope-creep)

---

## Sub-task Summary

| # | Task | Weight | Files |
|---|------|--------|-------|
| T1 | Dynamic import react-markdown in 3 pages | S | 3 page.tsx files |
| T2 | Viewport + metadata in root layout | S | app/layout.tsx |
| T3 | Cache headers in next.config.ts | S | next.config.ts |
| T4 | Performance audit report | S | docs/performance-audit.md |
| T5 | Tests | S | app/layout.test.tsx, next.config.test.ts |

**Total estimated new tests:** 6–8  
**Risk:** Low — T1 dynamic import pattern is well-tested in Next.js; T2/T3 are additive.

---

## Acceptance Criteria

- [ ] `react-markdown` no longer appears in the primary shared JS chunk (verify via chunk filename — it will get its own lazy chunk)
- [ ] `app/layout.tsx` exports both `metadata` (with title template and robots) and `viewport`
- [ ] `next.config.ts` `headers()` returns rules for `/_next/static/*` and `/api/*`
- [ ] `docs/performance-audit.md` exists with baseline metrics table and post-change summary
- [ ] All tests pass (existing 783 + new 6–8)
- [ ] `npm run build` succeeds
