# Security Policy

Control Tower is a **local-only** web dashboard that orchestrates [RedEye](https://github.com/Bitmia-ai/RedEye) sessions on your own machine. It reads your local Claude Code transcripts, spawns Claude processes, and writes to your projects' `.redeye/` control files.

By design Control Tower binds to `127.0.0.1` only and has no authentication. **Do not expose it to a public network.**

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **dev@bitmia.ai** with:
- A description of the issue
- Steps to reproduce
- The version of Control Tower affected
- Proof-of-concept code if applicable

Or use GitHub's [private security advisories](https://github.com/Bitmia-ai/ControlTower/security/advisories/new).

## What to expect

- Acknowledgment within 72 hours
- Assessment and remediation plan within 7 days for confirmed vulnerabilities
- Credit in release notes unless you prefer to stay anonymous

## Scope

We're particularly interested in:
- Command injection through project paths, backlog items, or steering directives written to disk
- Path traversal in API routes (especially project registry, backlog, steer, answer)
- Unauthenticated execution of shell commands on the host
- Secret leakage from transcripts, session logs, or cost API output
- Arbitrary file reads/writes outside the configured project paths
- Session-manager misuse (e.g., starting/killing processes outside the allowlist)

## Out of scope

- Any attack requiring access to the host's localhost (that's the trust model)
- Vulnerabilities in Next.js, Node, or Claude Code itself (report upstream)
- Issues in third-party dependencies without a Control Tower-specific exploit path

## Defense-in-depth: HTTP response headers

Even though Control Tower binds to `127.0.0.1` and `proxy.ts` blocks
cross-origin mutating requests at the middleware layer, the dashboard ships
a baseline set of security response headers from `next.config.ts`. They
close residual local-attack vectors (clickjacking, MIME-sniff, base-tag
injection, exfil via form submission to attacker origins, and inline-script
XSS) that the same-origin proxy alone does not cover.

The header set is declared in the `headers()` function in `next.config.ts`
on a catch-all rule (`source: "/(.*)"`) so it applies to every route — HTML
pages, API responses, and `_next/static/` assets. Next.js merges this rule
with the more-specific `Cache-Control` rules for `/_next/static/` (immutable)
and `/api/` (no-store).

| Header                    | Value                                              | Why                                                                                                 |
|---------------------------|----------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `Content-Security-Policy` | strict policy with per-environment `script-src`    | Limits what the browser will load and execute. See the directive table below.                       |
| `X-Frame-Options`         | `DENY`                                             | Belt-and-braces clickjacking defense for older browsers and reverse proxies that ignore CSP.        |
| `X-Content-Type-Options`  | `nosniff`                                          | Prevents the browser from MIME-sniffing a response into a more dangerous content type.              |
| `Referrer-Policy`         | `same-origin`                                      | Don't leak the referrer URL to third-party origins.                                                 |
| `Permissions-Policy`      | `camera=(), microphone=(), geolocation=()`         | Hard-disables device APIs the dashboard never uses, in case a future page accidentally requests one. |

### CSP directive breakdown

The CSP looks like this in production:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

Why each directive:

- `default-src 'self'` — fall-through baseline. Every directive that
  would otherwise default to `*` is anchored to the same origin.
- `script-src 'self' 'unsafe-inline'` — Next.js App Router injects small
  inline `<script>` blocks for theme detection, route prefetching, and
  hydration boot data. A nonce-based middleware that rewrites those
  inline scripts would let us drop `'unsafe-inline'`, but the
  localhost-only threat model in this file does not justify that
  complexity. The other directives (`frame-ancestors`, `base-uri`,
  `form-action`) still close the most common XSS-pivot vectors.
- `style-src 'self' 'unsafe-inline'` — Next.js inlines a small `<style>`
  block for above-the-fold CSS in production builds. Required.
- `font-src 'self'` — `next/font/google` self-hosts Geist and Geist Mono
  at build time, served from `/_next/static/`. No external fonts.
- `img-src 'self' data:` — Tailwind and `next/image` may produce inline
  `data:` URIs for placeholders/favicons. If we ever drop those uses,
  this can tighten to just `'self'`.
- `connect-src 'self'` — covers `fetch()` and `EventSource` (the live
  transcript SSE stream at `/api/projects/[id]/stream`).
- `frame-ancestors 'none'` — modern equivalent of `X-Frame-Options: DENY`.
  Strictly forbids embedding via `<iframe>`/`<frame>`/`<object>`.
- `base-uri 'self'` — blocks an injected `<base>` tag from rerouting all
  relative URLs to an attacker origin.
- `form-action 'self'` — same-origin forms only. Prevents data exfil via
  a posted form.

### Why `script-src` differs between dev and prod

Webpack dev mode (`npm run dev`) emits eval-based source maps for hot
module reload, which require the `'unsafe-eval'` CSP token. The
production bundles served from `/_next/static/` do not need it.

`next.config.ts` reads `process.env.NODE_ENV` inside the `headers()`
function:

```ts
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : "'self' 'unsafe-inline'";
```

So:
- `npm run dev`: `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- `npm run build && npm start`: `script-src 'self' 'unsafe-inline'`

`'unsafe-eval'` is **never** present in production. If you see it on a
production deployment, the build was started with `NODE_ENV` unset or
set to a non-`production` value — fix the environment, do not relax
the policy.

### Extending the CSP for a new external resource

If a feature needs to load a script, image, or font from a new origin,
add the origin to the corresponding directive in `next.config.ts`. For
example, to allow images from `cdn.example.com`:

```ts
"img-src 'self' data: https://cdn.example.com",
```

Rules of thumb:
- Prefer self-hosting over an external CDN. `next/font/google` already
  self-hosts Google Fonts at build time; do not add `fonts.gstatic.com`.
- Use HTTPS-only origins (`https://...`). Never add `http:` or `*` to a
  directive.
- Add tests in `next.config.test.ts` for the new directive entry.
- Add an entry to this section explaining why the origin is required.

### Relationship to the CSRF middleware

`proxy.ts` enforces same-origin and `Sec-Fetch-Site` checks on mutating
HTTP methods (POST/PUT/PATCH/DELETE). That is a separate, complementary
control: CSRF middleware blocks cross-origin **requests**; the headers
above limit what a same-origin response is allowed to **load and
execute** in the browser. Removing one does not eliminate the need for
the other.
