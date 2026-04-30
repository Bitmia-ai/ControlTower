import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </header>
  );
}
