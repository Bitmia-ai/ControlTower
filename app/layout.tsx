import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/client-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: {
    default: "Control Tower",
    template: "%s | Control Tower",
  },
  description: "RedEye autonomous dev agent dashboard — monitor and manage AI coding sessions",
  robots: { index: false, follow: false },
};

// Force-dynamic prevents static prerendering of layout-wrapped routes,
// sidestepping the null-React prerender crash on Next.js 16.2.4 + Turbopack.
// The _global-error prerender is additionally fixed via scripts/patch-next.mjs.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
        {/* ClientProviders ("use client") owns ThemeProvider (custom ESM),
            ToastProvider, and the site header (logo + ThemeToggle). Using a
            custom lib/theme-context instead of next-themes avoids the CJS
            require("react") that resolves to null in Turbopack prerender workers. */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
