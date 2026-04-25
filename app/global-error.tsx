"use client";

// global-error.tsx must be a Client Component (Next.js requirement).
// Keep it completely standalone — no imports from components/ — so that
// no context hooks (useContext) are reachable from this bundle.
// The /_global-error prerender failure on Next.js 16.2.4 + Turbopack + React 19
// is fixed by scripts/patch-next.mjs (postinstall) which prevents _global-error
// from entering staticPaths. This export is kept for consistency but has no
// effect on Client Components in Next.js App Router.
export const dynamic = "force-dynamic";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          backgroundColor: "#09090b",
          color: "#e4e4e7",
        }}
      >
        <p style={{ fontSize: "1rem", marginBottom: "1rem", opacity: 0.8 }}>
          Something went wrong.
        </p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #3f3f46",
              background: "transparent",
              color: "#e4e4e7",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #3f3f46",
              background: "transparent",
              color: "#e4e4e7",
              cursor: "pointer",
              fontSize: "0.875rem",
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
