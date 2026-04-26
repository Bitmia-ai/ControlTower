import type { ReactNode } from "react";

interface SectionHeaderProps {
  /** Optional lucide-react or other icon element rendered before the label */
  icon?: ReactNode;
  /** The section label text */
  label: string;
  /** Optional count badge rendered after the label */
  count?: number;
  /** Additional Tailwind classes for the wrapper */
  className?: string;
}

/**
 * Shared section header used across tasks, history, and live tabs.
 * Renders a small-caps label with optional icon and count badge,
 * matching the design of mission-control section headers.
 */
export function SectionHeader({ icon, label, count, className = "" }: SectionHeaderProps) {
  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 ${className}`}
    >
      {icon && (
        <span className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-normal normal-case tracking-normal font-sans">
          {count}
        </span>
      )}
    </div>
  );
}
