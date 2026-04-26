import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark React as external so Turbopack's static-generation workers resolve it via
  // Node's native require instead of the bundled CJS shim that returns null.
  // Fixes "Cannot read properties of null (reading 'useContext'/'use')" in
  // /_global-error prerender (Next.js 16 + React 19 + Turbopack bug).
  serverExternalPackages: ["react", "react-dom"],

  // Silence the "workspace root inferred" warning from Turbopack.
  // Turbopack finds multiple lockfiles (e.g. pnpm-lock.yaml at ~/
  // and package-lock.json here) and picks the wrong root. Pinning the
  // project root here removes the ambiguity.
  turbopack: {
    root: path.resolve(__dirname),
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
