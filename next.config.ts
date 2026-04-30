import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

// When building from a git worktree (e.g. .worktrees/T125/), node_modules is a
// stub with only vitest cache — the actual packages live in the main checkout.
// Turbopack has a security sandbox that refuses to follow symlinks outside its
// `root`, so we must set root to the real package root (the directory that
// contains a populated node_modules/next). Walk up from __dirname until we
// find it, capping at the filesystem root.
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "node_modules", "next", "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return startDir; // fallback: use cwd (build may still fail)
}

const turbopackRoot = findPackageRoot(path.resolve(__dirname));

const nextConfig: NextConfig = {
  // Silence the "workspace root inferred" warning from Turbopack and ensure
  // the sandbox root covers node_modules/next.  When running from a git
  // worktree the real node_modules lives in the main checkout (a parent dir).
  // (still used by `next build`; dev runs on webpack — see below).
  turbopack: {
    root: turbopackRoot,
  },

  // Dev runs on webpack (`next dev --webpack`) because Turbopack walks the
  // entire project root and has no documented directory-exclude API in
  // Next.js 16 (.gitignore is not honored by the watcher; vercel/turborepo#8765,
  // vercel/next.js#80665). RedEye's `.worktrees/T-*` and Claude Code's agent
  // worktrees at `.claude/worktrees/agent-*` are full project-tree clones —
  // when Turbopack indexes them the in-memory module graph explodes past
  // 80 GB on this machine, three times reproducibly. Webpack honors
  // `watchOptions.ignored`, so we mask both worktree systems out of the
  // dev-server file index. Production `next build` keeps Turbopack.
  webpack(config) {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: [
        "**/.git/**",
        "**/node_modules/**",
        "**/.next/**",
        "**/.claude/worktrees/**",
        "**/.worktrees/**",
      ],
    };
    return config;
  },

  // Explicit cache-control headers.
  // /_next/static/* assets are content-addressed (filename includes a hash),
  // so it is safe to cache them indefinitely (immutable).
  // /api/* routes are always dynamic — no-store prevents stale responses.
  //
  // Security headers (T155) live on a catch-all rule placed first so they
  // apply to every route (HTML, API, static assets). Next.js merges multiple
  // matching header rules, so the more-specific Cache-Control entries below
  // are preserved on the routes they target. See SECURITY.md for the policy
  // rationale and instructions for extending the CSP.
  //
  // The script-src directive is environment-aware:
  //   - prod uses 'self' 'unsafe-inline' because Next.js App Router injects
  //     small inline <script> blocks for theme detection, hydration data,
  //     and chunk loading. A nonce-based CSP (per-request middleware that
  //     rewrites <script> tags) would let us drop 'unsafe-inline', but the
  //     localhost-only threat model in SECURITY.md does not justify that
  //     complexity (see AD-1 in docs/specs/T155-security-headers.md).
  //   - dev additionally allows 'unsafe-eval' for webpack HMR source maps.
  // Other directives stay strict (self / data: / 'none') across both modes.
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self' 'unsafe-inline'";
    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Long-lived immutable caching is correct in prod (chunks are
      // content-addressed by hash) but lethal in dev: chunk URLs in dev mode
      // do not change when their bytes change, and the browser keeps serving
      // the immutable cached copy for a year. Gate the rule to prod-only so
      // dev edits show up on every reload.
      // vitest also runs with NODE_ENV=development, so we keep the rule in
      // tests via a VITEST=true exclusion to avoid breaking snapshots.
      ...(process.env.NODE_ENV === "development" && process.env.VITEST !== "true"
        ? []
        : [
            {
              source: "/_next/static/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]),
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
};

export default nextConfig;
