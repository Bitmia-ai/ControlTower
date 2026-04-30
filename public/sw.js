// Control Tower service worker — self-uninstaller.
//
// The previous version of this file was a NetworkFirst/CacheFirst PWA shell.
// In practice it caused dev/prod cache-inversion problems: anyone who once
// ran `npm start` ended up with a long-lived SW that intercepted requests
// across later `npm run dev` sessions and silently served stale HTML/JS.
//
// This version installs, immediately unregisters itself, wipes every
// CacheStorage entry it can see, and reloads every open client tab so the
// next request goes straight to the dev server. Browsers update SWs by
// byte-comparing this file on each navigation, so simply shipping new
// bytes is enough to evict the old caching SW from any user's machine.
//
// Offline support can return later via a versioned cache key
// (e.g. `ct-shell-v2`) once the inversion problem is solved a different
// way (per-route control, opt-in, etc.).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (err) {
        // Non-fatal — unregister still proceeds.
        console.warn("[CT SW] cache wipe failed:", err);
      }
      try {
        await self.registration.unregister();
      } catch (err) {
        console.warn("[CT SW] unregister failed:", err);
      }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          // Force the client to reload so it stops running against this SW.
          if ("navigate" in client) {
            await client.navigate(client.url);
          }
        }
      } catch (err) {
        console.warn("[CT SW] client reload failed:", err);
      }
    })()
  );
});

// Pass-through fetch — never intercept, so even before activate completes
// the network sees every request.
self.addEventListener("fetch", () => {});
