"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Toast } from "./toast-provider";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const cardClasses =
    "pointer-events-auto min-w-[260px] max-w-sm rounded-md border shadow-lg " +
    "bg-white border-gray-200 text-gray-900 " +
    "dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 " +
    "transition-all";

  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 text-sm leading-snug">{toast.message}</div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          // Prevent <Link> navigation when clicking the close button
          e.preventDefault();
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );

  if (toast.href) {
    return (
      <Link
        href={toast.href}
        className={cardClasses + " block hover:bg-gray-50 dark:hover:bg-zinc-800"}
        onClick={() => onDismiss(toast.id)}
      >
        {body}
      </Link>
    );
  }

  return <div className={cardClasses}>{body}</div>;
}
