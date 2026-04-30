"use client";

// OfflineBanner — slim top bar shown when navigator.onLine goes false.
// Non-blocking: does not prevent page interaction.
// Auto-hides when the connection is restored.

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Initialise from the current connectivity state so a page loaded
    // while offline shows the banner immediately without waiting for an event.
    setOffline(!navigator.onLine);

    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="w-full flex items-center justify-center gap-2 bg-amber-500 dark:bg-amber-600 text-white text-xs font-medium px-4 py-1.5"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>No network connection — showing cached data</span>
    </div>
  );
}
