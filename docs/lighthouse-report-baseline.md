# Control Tower — Lighthouse Baseline

**Date:** 2026-04-26 (T077, iteration 108)  
**Build:** Next.js 16.2.4 / React 19 / Turbopack  
**Environment:** Local dev machine, `http://127.0.0.1:3200`

---

## How to Run a Lighthouse Audit

Lighthouse requires a running production server. Steps:

```bash
# 1. Build the production bundle
NODE_ENV=production npm run build

# 2. Start the production server (in one terminal)
npm run start
# Server runs at http://127.0.0.1:3200

# 3. Run Lighthouse (in another terminal)
npx lighthouse http://127.0.0.1:3200 --output html --output-path ./docs/lighthouse-report.html

# 4. Open the report
open ./docs/lighthouse-report.html
```

Alternatively, use Chrome DevTools → Lighthouse tab while visiting `http://127.0.0.1:3200`.

---

## Build Output (Post-T077)

Build run: 2026-04-26, after T077 changes (per-page metadata, turbopack config).

```
Route (app)
  ƒ / (dynamic)
  ƒ /project/[id] (dynamic)
  ƒ /project/[id]/history (dynamic)
  ƒ /project/[id]/live (dynamic)
  ƒ /project/[id]/schedules (dynamic)
  ƒ /project/[id]/steer (dynamic)
  ƒ /project/[id]/tasks (dynamic)
  ƒ /project/[id]/tasks/[taskId] (dynamic)
  + 20 API routes (all dynamic)

Build time: ~1757ms (Turbopack)
TypeScript: clean in 2.2s
Static pages generated: 2
```

---

## Chunk Analysis (Post-T077)

Run from `du -sh .next/static/chunks/*.js | sort -rh`:

| Chunk (filename hash) | Size | Identified Contents |
|----------------------|------|---------------------|
| `00d-4n9-r.-_p.js`   | 228 KB | **Shared runtime** — React core (react/jsx-runtime, react-dom, scheduling), Next.js client runtime, Turbopack module system. This is the primary payload loaded on every page. |
| `0bjlx7h88o5tw.js`   | 140 KB | App-level shared code — likely includes Radix UI primitives, `next/navigation`, client layout code |
| `0b7c5ccvtb_di.js`   | 136 KB | App-level shared code — possibly includes mission control components, lucide-react icons |
| `03~yq9q893hmn.js`   | 112 KB | Route-level chunk (likely a page bundle) |
| `0s9ucy16~153c.js`   |  56 KB | Smaller route or component chunk |
| `0f69hnec.3okj.js`   |  48 KB | Component chunk |
| CSS bundle (`057f2hoiwplp..css`) | 108 KB | Tailwind v4 compiled CSS (tree-shaken) |
| **Total static dir** | **1.3 MB** | Uncompressed; production serves gzipped |

**Chunk count:** 24 JS files + 2 CSS files

---

## What's in the 228 KB Shared Runtime

The largest chunk (`00d-4n9-r.-_p.js`) is the Turbopack/Next.js shared client runtime. Analysis of identifiable strings:

- `react.element`, `react.portal`, `react.fragment`, `react.memo`, `react.lazy` — React core
- `react.dev/errors/` — React error messages (suggests dev/prod hybrid or full bundle)
- `NEXT_DEPLOYMENT_ID`, `getAssetPrefix`, `setAttributesFromProps` — Next.js runtime infrastructure
- Turbopack module loader infrastructure

This chunk is **not reducible without a major Next.js or React version change**. The React core (~45 KB gzipped) is a necessary payload for any React app. The Turbopack runtime overhead is specific to Next.js 16.

**Is 228 KB a concern?** Gzipped, this is roughly ~70 KB. For a local-only developer tool (not user-facing, not mobile, not on slow connections), this is acceptable. The T075 change to lazy-load `react-markdown` already addressed the most impactful optimization.

---

## Lighthouse Score Placeholder

The following scores are to be filled in when running Lighthouse against the production build:

| Metric | Score | Notes |
|--------|-------|-------|
| Performance | _TBD_ | Run `npx lighthouse http://127.0.0.1:3200` |
| Accessibility | _TBD_ | T024 (aria-labels) was shipped in iter 87 |
| Best Practices | _TBD_ | |
| SEO | _TBD_ | robots:noindex is intentional (local tool) |
| First Contentful Paint (FCP) | _TBD_ | |
| Largest Contentful Paint (LCP) | _TBD_ | |
| Total Blocking Time (TBT) | _TBD_ | |
| Cumulative Layout Shift (CLS) | _TBD_ | |

**Expected baseline (per T075 analysis):** 90+ on desktop given:
- Lean bundle (~70 KB gzip for shared runtime)
- Geist font served via `next/font/google` with `display: swap`
- No render-blocking resources
- react-markdown lazy-loaded (ships ~60 KB gzip only to pages that need it)

---

## Recommendations for Further Optimization

| Priority | Item | Effort | Status |
|----------|------|--------|--------|
| P2 | Run actual Lighthouse and fill in scores above | S | Pending (needs running server) |
| P2 | Investigate 140 KB + 136 KB chunks — identify if any Radix components can be lazy-loaded | M | Pending |
| P3 | Consider splitting the lucide-react icon set — only a subset is used | M | T076 (dep update) may help |
| P3 | Investigate CSS bundle (108 KB) — Tailwind v4 tree-shakes but Typography plugin adds size | M | Pending |
| P4 | Add per-page `<title>` to improve browser tab UX | DONE | T077 completed |
