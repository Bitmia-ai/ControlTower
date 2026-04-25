# Tester Reports

_(User Tester writes bug reports here. CTO merges to .redeye/backlog.md at TRIAGE, then clears this file.)_

## Format
Each report follows:
### BUG-{n}: {descriptive title}
- **Source:** User Tester (iteration {n})
- **Type:** bug
- **Severity:** broken | confusing | ugly
- **Steps to reproduce:** {numbered steps}
- **Expected / Actual:** {description}
- **Screenshot:** {filename}
- **Status:** pending-triage

## SCHED-1 Dependency Audit Report — 2026-04-25 (iter 107)

### npm audit
- **Findings:** 2 moderate severity vulnerabilities
- **Details:** `postcss < 8.5.10` — PostCSS XSS via unescaped `</style>` in CSS Stringify output (GHSA-qx2v-qp2m-jg93). This postcss is bundled inside `next` (node_modules/next/node_modules/postcss) — NOT the top-level postcss.
- **Fix availability:** `npm audit fix --force` would downgrade Next.js to 9.3.3 — a major breaking change. NOT safe to apply.
- **Risk assessment:** Moderate severity; postcss XSS applies only if user-supplied CSS is passed through PostCSS. Control Tower does not process user-supplied CSS at runtime. Risk is LOW in production.
- **Action:** No backlog item filed (no high/critical vulnerabilities). Monitor for Next.js upstream fix. Revisit on next SCHED-1 run.

### npm outdated
| Package | Current | Wanted | Latest | Notes |
|---------|---------|--------|--------|-------|
| @types/node | 20.19.39 | 20.19.39 | 25.6.0 | Major jump; type-only, generally safe |
| lucide-react | 1.9.0 | 1.11.0 | 1.11.0 | Minor; safe to update |
| react | 19.2.4 | 19.2.4 | 19.2.5 | Patch; safe to update |
| react-dom | 19.2.4 | 19.2.4 | 19.2.5 | Patch; safe to update |
| typescript | 5.9.3 | 5.9.3 | 6.0.3 | Major; needs testing before update |

- **Action:** No high/critical issues requiring immediate backlog items. Dependency updates are maintenance items. CEO may choose to add a dependency-update task to backlog when new features are requested.
