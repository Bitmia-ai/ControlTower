import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Control Tower",
  description: "RedEye autonomous dev agent dashboard",
};

// Force-dynamic: prevents Next.js from statically prerendering any layout-wrapped
// page in the build workers, where CJS React resolves to null and causes
// React.use/useContext errors in the App Router context setup.
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
        {/* ClientProviders is a "use client" component that wraps ThemeProvider,
            ToastProvider, the site header (with ThemeToggle), and page content.
            It uses next/dynamic with ssr:false for next-themes to prevent
            null.useContext build failures on /_global-error and /_not-found. */}
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
