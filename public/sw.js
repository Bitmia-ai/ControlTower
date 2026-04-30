// Control Tower Service Worker — shell caching for PWA offline support.
// Production only: ServiceWorkerRegistrar (components/service-worker-registrar.tsx)
// only registers this file when process.env.NODE_ENV === "production".
//
// Caching strategy:
//   /_next/static/*   → CacheFirst (content-addressed by hash, safe to keep indefinitely)
//   HTML pages        → NetworkFirst with offline fallback to /offline
//   Static icons/SW   → CacheFirst
//   /api/*            → Not intercepted (always live)
//   SSE streams       → Not intercepted (text/event-stream)

const CACHE_NAME = "ct-shell-v1";

// Pre-cache these URLs on SW install so the shell is ready offline immediately.
const SHELL_URLS = ["/", "/offline"];

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(SHELL_URLS).catch((err) => {
          // Non-fatal: if pre-caching fails (e.g. server not yet ready during
          // build-time SW warm-up), the SW still activates. Pages are cached
          // lazily on first navigation.
          console.warn("[CT SW] Pre-cache failed:", err);
        })
      )
  );
  // Activate immediately without waiting for existing tabs to close.
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  // Take control of all open clients without requiring a reload.
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Never intercept API routes — always live.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Never intercept SSE streams.
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/event-stream")) {
    return;
  }

  // Never intercept webpack HMR or other Next.js dev internals.
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("__nextjs")
  ) {
    return;
  }

  // Static assets: CacheFirst (content-addressed — safe to serve stale).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Public static files: CacheFirst.
  if (
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/logo.svg" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML navigation requests: NetworkFirst with offline fallback.
  if (accept.includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }
});

// ─── Strategy helpers ────────────────────────────────────────────────────────

/**
 * CacheFirst: serve from cache if available, otherwise fetch and cache.
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return a minimal error response — caller decides how to surface it.
    return new Response("Offline", { status: 503 });
  }
}

/**
 * NetworkFirst: try network, fall back to cache, then /offline fallback page.
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Ultimate fallback: the pre-cached offline page.
    const offlinePage = await caches.match("/offline");
    return (
      offlinePage ??
      new Response("You're offline", {
        status: 503,
        headers: { "Content-Type": "text/html" },
      })
    );
  }
}
