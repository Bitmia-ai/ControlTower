"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddProjectDialog({ open, onOpenChange, onAdded }: AddProjectDialogProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add project");
        return;
      }

      const listRes = await fetch("/api/projects");
      const listJson = await listRes.json();
      const projects: Array<{ name: string; path: string; initialized: boolean }> =
        listJson.data ?? [];
      const newIndex = projects.findIndex((p) => p.path === path);

      setName("");
      setPath("");
      onOpenChange(false);
      onAdded();

      if (newIndex >= 0) {
        router.push(`/project/${newIndex}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-1">
            Add Project
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            Register a local project directory with Control Tower.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-app"
                required
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
                Path
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/Users/you/my-app"
                required
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

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
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-md transition"
              >
                {loading ? "Adding..." : "Add Project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
