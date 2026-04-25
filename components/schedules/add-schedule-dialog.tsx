"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface AddScheduleDialogProps {
  projectId: number | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

/**
 * Modal dialog for creating a new schedule entry.  POSTs to
 * `/api/projects/{projectId}/schedules` and on success calls onAdded()
 * so the parent can refetch the list.
 *
 * Steps are entered as one-per-line in a textarea — empty lines are
 * filtered out before submit.
 */
export function AddScheduleDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: AddScheduleDialogProps) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedFreq = frequency.trim();
  const stepLines = stepsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const canSubmit =
    !loading && trimmedName.length > 0 && trimmedFreq.length > 0 && stepLines.length > 0;

  function reset() {
    setName("");
    setFrequency("");
    setStepsText("");
    setDescription("");
    setShowDetails(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        frequency: trimmedFreq,
        steps: stepLines,
      };
      if (showDetails && description.trim().length > 0) {
        body.description = description.trim();
      }
      const res = await fetch(`/api/projects/${projectId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to add schedule");
        return;
      }
      reset();
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
            Add Schedule
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            Define a new recurring task. The team picks it up on its next
            iteration.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="schedule-name"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500"
              >
                Name
              </label>
              <input
                id="schedule-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly dependency audit"
                aria-label="Schedule name"
                required
                autoFocus
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="schedule-frequency"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500"
              >
                Frequency
              </label>
              <input
                id="schedule-frequency"
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g. every 7d, every 1h, daily"
                aria-label="Schedule frequency"
                required
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="schedule-steps"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500"
              >
                Steps (one per line)
              </label>
              <textarea
                id="schedule-steps"
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                placeholder={"1. Run npm audit\n2. Report findings to .redeye/tester-reports.md"}
                aria-label="Schedule steps"
                rows={5}
                required
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 text-left transition"
            >
              {showDetails ? "▼ Hide details" : "▶ Add details"}
            </button>

            {showDetails && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="schedule-description"
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500"
                >
                  Description (optional)
                </label>
                <textarea
                  id="schedule-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this task accomplish?"
                  aria-label="Schedule description"
                  rows={3}
                  className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
                />
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
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
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition"
              >
                {loading ? "Adding…" : "Add Schedule"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
