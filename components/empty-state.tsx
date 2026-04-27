import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {icon && (
        <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
          <span className="text-gray-400 dark:text-zinc-500 text-lg">{icon}</span>
        </div>
      )}
      <p className="text-gray-500 dark:text-zinc-500 text-base mb-1">{title}</p>
      {subtitle && (
        <p className="text-gray-400 dark:text-zinc-600 text-sm mb-6 max-w-sm">{subtitle}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
