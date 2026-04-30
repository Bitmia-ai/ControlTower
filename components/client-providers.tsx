"use client";

// AppShell: provides ThemeProvider (custom ESM), ToastProvider, the site header.
// We use our own lib/theme-context ThemeProvider instead of next-themes so that
// native ESM React imports are used — next-themes' CJS require("react") resolved
// to null in Turbopack's prerender worker, causing null.useContext build failures.
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/toast-provider";
import { NotificationsProvider } from "@/components/notifications-provider";
import { NotificationDrawer } from "@/components/notification-drawer";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { OfflineBanner } from "@/components/offline-banner";
import { TopBar } from "@/components/redesign/top-bar";
import { MobileTabBar } from "@/components/redesign/mobile-tab-bar";

/** Exported as both names so imports don't need to change. */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <NotificationsProvider>
          <ServiceWorkerRegistrar />
          <TopBar />
          <OfflineBanner />
          <NotificationDrawer />
          {children}
          <MobileTabBar />
        </NotificationsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
