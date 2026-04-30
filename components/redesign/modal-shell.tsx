"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, CSSProperties } from "react";
import { Icon, type IconName } from "./icon";

interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible label for the dialog root. Used by aria-label when no <Dialog.Title> is provided. */
  ariaLabel?: string;
  /** Pixel width of the modal body. Defaults to 540. */
  width?: number;
  children: ReactNode;
}

/**
 * Polished modal surface used by every redesigned dialog. Provides:
 *   • opaque backdrop with a 2px blur
 *   • centered card with the redesign tokens (--bg-1 surface, --line border,
 *     var(--shadow-2) lift)
 *   • Esc / outside-click close (Radix Dialog defaults)
 *
 * Compose ModalHeader / ModalBody / ModalFooter inside for the standard
 * three-section layout. Width can be overridden per-modal via the `width`
 * prop.
 */
export function ModalShell({
  open,
  onOpenChange,
  ariaLabel,
  width = 540,
  children,
}: ModalShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{
            background: "oklch(0 0 0 / 0.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
        <Dialog.Content
          aria-label={ariaLabel}
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col"
          style={{
            width,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 64px)",
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow:
              "var(--shadow-2), 0 24px 60px oklch(0 0 0 / 0.45)",
          }}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Status-tint slot color for ModalHeader's icon pill. */
export type ModalHeaderTone =
  | "neutral"
  | "violet"
  | "mint"
  | "amber"
  | "rose"
  | "sky"
  | "red";

const TONE: Record<ModalHeaderTone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--bg-2)", fg: "var(--fg-1)" },
  violet: { bg: "var(--violet-tint)", fg: "var(--violet)" },
  mint: { bg: "var(--mint-tint)", fg: "var(--mint)" },
  amber: { bg: "var(--amber-tint)", fg: "var(--amber)" },
  rose: { bg: "var(--rose-tint)", fg: "var(--rose)" },
  sky: { bg: "var(--sky-tint)", fg: "var(--sky)" },
  red: { bg: "var(--red-tint)", fg: "var(--red)" },
};

interface ModalHeaderProps {
  icon: IconName;
  tone?: ModalHeaderTone;
  title: string;
  subtitle?: ReactNode;
  /** Optional element rendered to the right of the close button (e.g. badges). */
  trailing?: ReactNode;
  /** Set to false to suppress the bottom hairline (e.g. when the body has its own header). */
  divider?: boolean;
}

/**
 * Header used by every redesigned modal. Renders a tinted icon pill, a
 * title + subtitle stack, and a close button on the right. The title is
 * wrapped in <Dialog.Title> so screen readers announce it on open.
 */
export function ModalHeader({
  icon,
  tone = "neutral",
  title,
  subtitle,
  trailing,
  divider = true,
}: ModalHeaderProps) {
  const colors = TONE[tone];
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "16px 22px",
        gap: 12,
        ...(divider ? { borderBottom: "1px solid var(--line)" } : null),
      }}
    >
      <div className="flex items-center min-w-0" style={{ gap: 12 }}>
        <span
          className="flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: colors.bg,
            color: colors.fg,
            flex: "none",
          }}
          aria-hidden
        >
          <Icon name={icon} size={15} />
        </span>
        <div className="min-w-0">
          <Dialog.Title
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--fg-0)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </Dialog.Title>
          {subtitle && (
            <Dialog.Description asChild>
              <div
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "var(--fg-2)",
                  lineHeight: 1.45,
                }}
              >
                {subtitle}
              </div>
            </Dialog.Description>
          )}
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 6, flex: "none" }}>
        {trailing}
        <Dialog.Close asChild>
          <button
            type="button"
            className="btn ghost icon-only sm"
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </Dialog.Close>
      </div>
    </div>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  /** Disable the default scroll behaviour for short modals. */
  scroll?: boolean;
  /** Override the inner padding. Defaults to 22px / 22px. */
  padding?: CSSProperties["padding"];
  /** Vertical gap between direct children. Defaults to 14. */
  gap?: number;
}

export function ModalBody({
  children,
  scroll = true,
  padding = "20px 22px",
  gap = 14,
}: ModalBodyProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        padding,
        gap,
        ...(scroll
          ? { overflow: "auto", flex: 1, minHeight: 0 }
          : null),
      }}
    >
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  /** Optional helper text (e.g. file path the action writes to) shown on the left. */
  hint?: ReactNode;
}

export function ModalFooter({ children, hint }: ModalFooterProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "12px 22px",
        gap: 12,
        borderTop: "1px solid var(--line)",
        background: "var(--bg-0)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--fg-3)", minWidth: 0 }}>
        {hint}
      </div>
      <div className="flex items-center" style={{ gap: 8 }}>{children}</div>
    </div>
  );
}
