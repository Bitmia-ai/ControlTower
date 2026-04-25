import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark React as external so Turbopack's static-generation workers resolve it via
  // Node's native require instead of the bundled CJS shim that returns null.
  // Fixes "Cannot read properties of null (reading 'useContext'/'use')" in
  // /_global-error prerender (Next.js 16 + React 19 + Turbopack bug).
  serverExternalPackages: ["react", "react-dom"],
};

export default nextConfig;
