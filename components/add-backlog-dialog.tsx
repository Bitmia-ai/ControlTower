"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface AddBacklogDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddBacklogDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: AddBacklogDialogProps) {
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { text };
      if (showDetails && description.trim()) body.description = description;
      if (showDetails) body.priority = priority;

      const res = await fetch(`/api/projects/${projectId}/backlog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add item");
        return;
      }
      setText("");
      setDescription("");
      setPriority("P1");
      setShowDetails(false);
      onOpenChange(false);
      onAdded();
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
            Add to Backlog
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            Add a new item to the CEO request queue.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Quick-add text field */}
            <input
              id="backlog-title"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to be done?"
              aria-label="Task title"
              required
              autoFocus
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
            />

            {/* Expandable details */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 text-left transition"
            >
              {showDetails ? "▼ Hide details" : "▶ Add details"}
            </button>

            {showDetails && (
              <div className="flex flex-col gap-3">
                <textarea
                  id="backlog-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description…"
                  aria-label="Task description"
                  rows={3}
                  className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="backlog-priority"
                    className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide"
                  >
                    Priority
                  </label>
                  <select
                    id="backlog-priority"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as "P0" | "P1" | "P2")
                    }
                    className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:border-red-600 transition"
                  >
                    <option value="P0">P0 — Critical</option>
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Normal</option>
                  </select>
                </div>
              </div>
            )}

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
                disabled={loading || !text.trim()}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-md transition"
              >
                {loading ? "Adding…" : "Add Item"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
