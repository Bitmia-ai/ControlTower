"use client";

import type { InboxQuestion } from "@/lib/redeye-types";

interface QuestionsCardProps {
  questions: InboxQuestion[];
  onAnswer?: () => void;
}

export function QuestionsCard({ questions, onAnswer }: QuestionsCardProps) {
  const pending = questions.filter((q) => !q.answered);
  const hasPending = pending.length > 0;
  const first = pending[0];

  return (
    <div
      className={`border border-l-4 rounded-lg p-5 transition-colors ${
        hasPending
          ? "border-red-600 bg-red-50 dark:bg-red-950/50"
          : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 border-l-gray-300 dark:border-l-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">
          Questions
          {hasPending && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold h-4 min-w-[1rem] px-1">
              {pending.length}
            </span>
          )}
        </p>
      </div>

      {!hasPending ? (
        <span className="text-gray-400 dark:text-zinc-600 text-sm">No pending questions</span>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">{first.question}</p>
          {first.context && (
            <p className="text-xs text-gray-500 dark:text-zinc-500 line-clamp-2">{first.context}</p>
          )}
          {first.options && first.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {first.options.map((opt) => (
                <span
                  key={opt}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={onAnswer}
            className="mt-1 inline-flex items-center px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition"
          >
            Answer
            {pending.length > 1 && (
              <span className="ml-1.5 text-red-200">
                +{pending.length - 1} more
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
