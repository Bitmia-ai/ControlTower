"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

interface TabSpec {
  key: string;
  href: string | null;
  icon: IconName;
  label: string;
  disabled?: boolean;
  active: boolean;
}

function projectIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/project\/([^/]+)/);
  return m ? m[1] : null;
}

/**
 * Mobile bottom tab bar — sticky, safe-area-aware, mobile-only.
 *
 * Tabs:
 *   Home   — `/`           (global)
 *   Inbox  — `/inbox`      (global)
 *   Live   — project-scoped; only renders when the user is inside a
 *            `/project/[id]/*` route. Links to `/project/[id]/live`.
 *   Settings — disabled placeholder; greyed out per design.
 *
 * Hidden on `md:` and up via `.mobile-only` (defined in globals.css).
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const projectId = projectIdFromPath(pathname);
  const onProject = projectId !== null;
  const onLive = onProject && pathname?.endsWith("/live");

  const tabs: TabSpec[] = [
    {
      key: "home",
      href: "/",
      icon: "home",
      label: "Home",
      active: pathname === "/" || pathname === "",
    },
    {
      key: "inbox",
      href: "/inbox",
      icon: "inbox",
      label: "Inbox",
      active: pathname?.startsWith("/inbox") ?? false,
    },
    onProject
      ? {
          key: "live",
          href: `/project/${projectId}/live`,
          icon: "eye",
          label: "Live",
          active: Boolean(onLive),
        }
      : {
          key: "live",
          href: null,
          icon: "eye",
          label: "Live",
          active: false,
          disabled: true,
        },
    {
      key: "settings",
      href: null,
      icon: "settings",
      label: "Settings",
      active: false,
      disabled: true,
    },
  ];

  return (
    <nav
      aria-label="Bottom navigation"
      // .mobile-only owns the display rule (none on desktop, flex on mobile);
      // do NOT set display via inline style here — it would override the
      // media-query toggle and the bar would show on desktop too.
      className="mobile-only safe-bottom"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: "var(--bg-0)",
        borderTop: "1px solid var(--line)",
      }}
    >
      {tabs.map((t) => {
        const color = t.disabled
          ? "var(--fg-3)"
          : t.active
            ? "var(--fg-0)"
            : "var(--fg-2)";
        const content = (
          <span
            className="flex flex-col items-center justify-center"
            style={{
              gap: 2,
              padding: "8px 4px",
              color,
              fontSize: 10,
              lineHeight: 1,
              letterSpacing: "0.04em",
            }}
          >
            <Icon name={t.icon} size={20} strokeWidth={t.active ? 2 : 1.6} />
            <span>{t.label}</span>
          </span>
        );

        if (t.disabled || !t.href) {
          return (
            <span
              key={t.key}
              aria-disabled
              style={{
                flex: 1,
                opacity: 0.5,
                cursor: "not-allowed",
                display: "flex",
                justifyContent: "center",
              }}
              title={`${t.label} — coming soon`}
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            style={{
              flex: 1,
              textDecoration: "none",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
