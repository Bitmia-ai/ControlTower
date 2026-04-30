"use client";

// ServiceWorkerRegistrar — registers public/sw.js in production, and tears
// down any SW lingering from a previous prod session in dev. Render-nothing.

import { useEffect } from "react";
import * as logger from "@/lib/logger";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Non-fatal — SW registration failure should never break the app.
          logger.warn("CT/sw-registrar", "SW registration failed:", err);
        });
      return;
    }

    // Dev mode: tear down any SW that lingered from a previous prod session
    // and wipe its caches. Otherwise the prod SW intercepts requests and
    // serves stale HTML/JS, so dev edits look like they aren't taking effect.
    void (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) return;
        await Promise.all(regs.map((r) => r.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        // Reload once so the page no longer runs against the SW that just
        // unregistered — without this, the user keeps seeing the cached
        // bundle until they reload manually.
        logger.info(
          "CT/sw-registrar",
          "Dev mode: unregistered prod SW + cleared caches; reloading."
        );
        window.location.reload();
      } catch (err) {
        logger.warn("CT/sw-registrar", "Dev SW cleanup failed:", err);
      }
    })();
  }, []);

  return null;
}
