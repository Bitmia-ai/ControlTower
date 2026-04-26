import path from "path";
import type { NextConfig } from "next";
import type { Configuration as WebpackConfiguration } from "webpack";

const nextConfig: NextConfig = {
  // Silence the "workspace root inferred" warning from Turbopack
  // (still used by `next build`; dev runs on webpack — see below).
  turbopack: {
    root: path.resolve(__dirname),
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
  webpack(config: WebpackConfiguration) {
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
};

export default nextConfig;
