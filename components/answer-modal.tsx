"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { InboxQuestion } from "@/lib/redeye-types";

interface AnswerModalProps {
  question: InboxQuestion;
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnswered: () => void;
}

export function AnswerModal({
  question,
  projectId,
  open,
  onOpenChange,
  onAnswered,
}: AnswerModalProps) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to submit answer");
        return;
      }
      setAnswer("");
      onOpenChange(false);
      onAnswered();
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
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-2 leading-snug">
            {question.question}
          </Dialog.Title>

          {question.context && (
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">
              Asked while working on: {question.context}
            </p>
          )}

          {question.default && (
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              Proceeded with: {question.default}
            </p>
          )}

          {question.options && question.options.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {question.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(opt)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition ${
                    answer === opt
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              aria-label="Your answer"
              rows={3}
              className="bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-red-600 transition resize-none"
            />

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-3">
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
                disabled={loading || !answer.trim()}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-md transition"
              >
                {loading ? "Submitting…" : "Submit Answer"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
