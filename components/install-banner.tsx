"use client";

// InstallBanner — shows a dismissible nudge when the browser fires
// `beforeinstallprompt` (Chrome/Edge desktop + Android Chrome).
// Appears on the home page only; dismissed state is in sessionStorage
// so it reappears after a full browser restart but stays hidden within a session.

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/** sessionStorage key — one banner per browser session. */
export const INSTALL_BANNER_DISMISS_KEY = "ct-install-banner-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already dismissed this session — stay hidden.
    try {
      if (sessionStorage.getItem(INSTALL_BANNER_DISMISS_KEY)) {
        setDismissed(true);
        return;
      }
    } catch {
      // Private mode or quota — ignore, treat as not dismissed.
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    // Whether the user accepts or dismisses the native prompt, hide the banner.
    await prompt.userChoice;
    dismiss();
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(INSTALL_BANNER_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
    setPrompt(null);
  };

  if (dismissed || !prompt) return null;

  return (
    <div
      role="region"
      aria-label="Install Control Tower as an app"
      data-testid="install-banner"
      className="mx-4 sm:mx-6 mt-4 mb-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-red-600 dark:text-red-400 shrink-0">
          Install Control Tower
        </span>
        <span className="text-gray-600 dark:text-gray-400 truncate">
          — add to your home screen for quick access
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          data-testid="install-banner-install-btn"
          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 min-h-[36px]"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss install banner"
          data-testid="install-banner-dismiss-btn"
          className="rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
