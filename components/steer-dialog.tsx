"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface SteerDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSteered: () => void;
}

export function SteerDialog({
  projectId,
  open,
  onOpenChange,
  onSteered,
}: SteerDialogProps) {
  const [directive, setDirective] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!directive.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send directive");
        return;
      }
      setDirective("");
      onOpenChange(false);
      onSteered();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-1">
            Steer Agent
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            Send a directive to guide the agent&apos;s next actions.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              placeholder="e.g. Focus on fixing the auth bug before anything else…"
              rows={4}
              autoFocus
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
            />

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-3 mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading || !directive.trim()}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-md transition"
              >
                {loading ? "Sending…" : "Send Directive"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
