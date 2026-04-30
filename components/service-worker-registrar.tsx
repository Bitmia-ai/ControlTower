"use client";

// ServiceWorkerRegistrar — registers public/sw.js in production builds only.
// This is a render-nothing client component intentionally; it runs only
// client-side via useEffect. In dev (NODE_ENV !== "production") it is a no-op
// so webpack HMR is never disrupted by an active SW.

import { useEffect } from "react";
import * as logger from "@/lib/logger";

/** Registers the production service worker. Renders nothing. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        // Non-fatal — SW registration failure should never break the app.
        logger.warn("CT/sw-registrar", "SW registration failed:", err);
      });
  }, []);

  return null;
}
