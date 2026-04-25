import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <header className="border-b border-gray-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
              <Link
                href="/"
                aria-label="Control Tower — go to home"
                className="flex flex-col items-start leading-none select-none"
              >
                <span className="text-xs font-bold tracking-widest text-red-600 dark:text-red-500 uppercase">
                  Control
                </span>
                <span className="text-lg font-black text-red-600 dark:text-red-500 uppercase leading-none">
                  Tower
                </span>
              </Link>
              <ThemeToggle />
            </header>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
