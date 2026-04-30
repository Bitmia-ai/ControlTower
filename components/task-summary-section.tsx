"use client";

import { useState } from "react";

interface SummarySectionProps {
  summary: string;
  /** When true, the section starts expanded. Used for done items. */
  defaultOpen?: boolean;
}

const PREVIEW_CHARS = 120;

/**
 * Collapsible summary block (T026).
 *
 * Renders a green-accented section with the LLM-authored summary of a task
 * item. Expanded by default for done items; collapsed otherwise so non-done
 * items don't dominate the page.
 */
export function TaskSummarySection({
  summary,
  defaultOpen = false,
}: SummarySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Don't render an empty section
  if (!summary || summary.trim().length === 0) return null;

  const trimmed = summary.trim();
  const needsTruncation = trimmed.length > PREVIEW_CHARS;
  const preview = needsTruncation
    ? trimmed.slice(0, PREVIEW_CHARS).trimEnd() + "…"
    : trimmed;

  return (
    <section
      data-testid="summary-section"
      className="mt-6 pt-6 border-t border-gray-200 dark:border-zinc-800"
    >
      <div className="border-l-4 border-l-green-500 pl-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-green-600 dark:text-green-400">
            Summary
          </h3>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="task-summary-body"
            aria-label={open ? "Collapse summary" : "Expand summary"}
            className="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition"
          >
            <svg
              className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div id="task-summary-body">
          {open ? (
            <p
              data-testid="summary-full"
              className="text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap"
            >
              {trimmed}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p
                data-testid="summary-preview"
                className="text-sm text-gray-500 dark:text-zinc-400 whitespace-pre-wrap"
              >
                {preview}
              </p>
              {needsTruncation && (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline self-start"
                >
                  Show more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
