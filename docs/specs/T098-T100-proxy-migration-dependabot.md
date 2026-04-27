# T098+T100: middleware→proxy migration + Dependabot config

## Overview

Bundle two P2 chores:
- **T098**: Migrate `middleware.ts` to `proxy.ts` (Next.js 16 deprecation)
- **T100**: Add `.github/dependabot.yml` for automated dependency PRs

---

## T098: middleware→proxy migration

### Context

Next.js 16 deprecated the `middleware` file convention in favor of `proxy`. Every dev server start currently prints:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

The existing `middleware.ts` implements CSRF/origin protection on all mutating API routes:
- Validates `Sec-Fetch-Site` header (modern browsers) and falls back to `Origin` header
- Blocks cross-origin POST/PUT/DELETE/PATCH with 403
- Only allows `GET`, `HEAD`, `OPTIONS` unconditionally
- Matcher: `/api/:path*`

### Migration approach

The `proxy.ts` convention uses identical exports to `middleware.ts`:
- Same `middleware(req: NextRequest)` function export
- Same `config` export with `matcher`
- Same `NextRequest` / `NextResponse` API

**Steps:**
1. Copy `middleware.ts` content to `proxy.ts` (no logic changes)
2. Delete `middleware.ts`
3. Write unit tests in `proxy.test.ts` (using `@vitest-environment node`)
4. Verify build is clean and deprecation warning is gone

### Test plan for proxy.test.ts

Test the `isSameOrigin` helper and `middleware` function:

| Scenario | Input | Expected |
|---|---|---|
| GET always passes | GET, cross-site sec-fetch | 200 (next) |
| HEAD always passes | HEAD, no headers | 200 (next) |
| OPTIONS always passes | OPTIONS, cross-site | 200 (next) |
| POST same-origin sec-fetch | POST, sec-fetch-site: same-origin | 200 (next) |
| POST sec-fetch: none | POST, sec-fetch-site: none | 200 (next) |
| POST cross-site sec-fetch | POST, sec-fetch-site: cross-site | 403 |
| POST same-site sec-fetch | POST, sec-fetch-site: same-site | 403 |
| POST allowed origin | POST, origin: http://127.0.0.1:3200 | 200 (next) |
| POST allowed origin localhost | POST, origin: http://localhost:3200 | 200 (next) |
| POST allowed origin IPv6 | POST, origin: http://[::1]:3200 | 200 (next) |
| POST foreign origin | POST, origin: http://evil.com | 403 |
| POST no headers | POST, no sec-fetch, no origin | 403 (fail closed) |
| POST malformed origin | POST, origin: not-a-url | 403 |
| DELETE cross-site | DELETE, sec-fetch-site: cross-site | 403 |

Approximately 13 tests. Use `@vitest-environment node` annotation.

### Acceptance criteria

- [ ] `proxy.ts` exists at project root with same CSRF logic as `middleware.ts`
- [ ] `middleware.ts` deleted
- [ ] `proxy.test.ts` exists with >= 10 tests, all passing
- [ ] `npm run build` clean, no deprecation warning
- [ ] `npx vitest run` passes (no regressions)

---

## T100: Dependabot config

### File: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      minor-patch:
        update-types:
          - minor
          - patch
    ignore:
      - dependency-name: next
        update-types: ["version-update:semver-major"]
      - dependency-name: react
        update-types: ["version-update:semver-major"]
      - dependency-name: react-dom
        update-types: ["version-update:semver-major"]
      - dependency-name: tailwindcss
        update-types: ["version-update:semver-major"]
    open-pull-requests-limit: 5
    labels:
      - dependencies

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - github-actions
```

### Acceptance criteria

- [ ] `.github/dependabot.yml` created with npm + github-actions ecosystems
- [ ] Weekly Monday schedule
- [ ] Minor/patch updates grouped
- [ ] Major bumps ignored for next, react, react-dom, tailwindcss
- [ ] PR limit: 5 per ecosystem

---

## Sub-tasks

| ID | Description | Size |
|---|---|---|
| S1 | Create `proxy.ts` from `middleware.ts` content | S |
| S2 | Delete `middleware.ts` | S |
| S3 | Write `proxy.test.ts` with ~13 tests | S |
| S4 | Create `.github/dependabot.yml` | S |
| S5 | Full verify: build + vitest | S |

No CEO questions needed. Migration is straightforward — same API, different filename.
