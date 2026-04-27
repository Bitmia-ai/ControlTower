"use client";

// AppShell: provides ThemeProvider (custom ESM), ToastProvider, the site header.
// We use our own lib/theme-context ThemeProvider instead of next-themes so that
// native ESM React imports are used — next-themes' CJS require("react") resolved
// to null in Turbopack's prerender worker, causing null.useContext build failures.
import Link from "next/link";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";
import { Logo } from "@/components/logo";

/** Exported as both names so imports don't need to change. */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <header className="border-b border-gray-200 dark:border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            aria-label="Control Tower — go to home"
            className="flex items-center gap-2 leading-none select-none text-gray-900 dark:text-gray-100"
          >
            <Logo className="h-14 w-14" />
            <span className="flex flex-col items-start">
              <span className="text-xs font-bold tracking-widest text-red-600 dark:text-red-500 uppercase">
                Control
              </span>
              <span className="text-lg font-black text-red-600 dark:text-red-500 uppercase leading-none">
                Tower
              </span>
            </span>
          </Link>
          <ThemeToggle />
        </header>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
