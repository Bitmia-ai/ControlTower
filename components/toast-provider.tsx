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

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `toast-${Date.now()}-${_idCounter}`;
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
