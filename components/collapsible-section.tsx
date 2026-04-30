"use client";

import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Collapse ${label} items` : `Show ${label} items`}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-800 transition-colors group ${
          open
            ? "hover:bg-gray-50 dark:hover:bg-zinc-800/40"
            : "bg-gray-100 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800/60"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            className={`w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {label}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400 font-mono tabular-nums"
            data-testid="collapsible-count"
          >
            {count}
          </span>
        </div>
        <span className="text-xs text-gray-400 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-500 transition-colors">
          {open ? "collapse" : "expand to view"}
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
