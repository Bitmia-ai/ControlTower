import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline",
};

/**
 * Offline fallback page — served by the service worker when a navigation
 * request fails (no network) and the page is not in the cache.
 */
export default function OfflinePage() {
  return (
    <main
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center"
      data-testid="offline-page"
    >
      <WifiOff className="h-12 w-12 text-amber-500" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">You&apos;re offline</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          Control Tower is not reachable right now. Cached pages will load
          normally — try navigating to a page you&apos;ve visited before.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        data-testid="offline-home-link"
      >
        Try home page
      </Link>
    </main>
  );
}
