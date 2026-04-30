"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ToastContainer } from "./toast-container";

export interface Toast {
  id: string;
  message: string;
  href?: string;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, href?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const noop = () => {};
const fallbackCtx: ToastContextValue = {
  toasts: [],
  showToast: noop,
  dismissToast: noop,
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Return a no-op fallback when there is no provider (e.g. during /_global-error
  // prerender, which runs without the root layout's ToastProvider).
  return ctx ?? fallbackCtx;
}

function nextId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `toast-${crypto.randomUUID()}`;
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, href?: string, duration: number = 5000) => {
      const toast: Toast = { id: nextId(), message, href, duration };
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
