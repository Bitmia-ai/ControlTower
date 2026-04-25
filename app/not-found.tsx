// Root-level 404 page. Server component with force-dynamic to prevent
// Next.js 16 Turbopack prerender failures on /_not-found.
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1
        style={{ fontSize: "3rem", fontWeight: 900, margin: 0, color: "#dc2626" }}
      >
        404
      </h1>
      <p style={{ fontSize: "1.125rem", margin: 0 }}>
        Page not found.
      </p>
      <a
        href="/"
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "0.375rem",
          border: "1px solid currentColor",
          textDecoration: "none",
          fontSize: "0.875rem",
        }}
      >
        Go home
      </a>
    </div>
  );
}
