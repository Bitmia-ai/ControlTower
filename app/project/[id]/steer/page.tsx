"use client";

import { useEffect, useState, useCallback, use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SteeringDirective } from "@/lib/redeye-types";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";

function DirectivesSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 bg-gray-100 dark:bg-zinc-800/60 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

function DirectiveRow({ directive }: { directive: SteeringDirective }) {
  // Extract trailing date in parens if present, e.g. "Focus on UX (2026-04-25)"
  // [\s\S] (instead of `.` with the `s` flag) so multi-line markdown directives
  // still get the trailing date stripped.
  const match = directive.text.match(/^([\s\S]*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/);
  const rawText = match ? match[1] : directive.text;
  const text = rawText.replace(/^\n+/, "");
  const date = match ? match[2] : directive.timestamp;

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-t-[3px] border-t-zinc-300 dark:border-t-zinc-700 rounded-lg">
      <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none break-words flex-1 text-gray-900 dark:text-zinc-100 prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-a:text-red-600 dark:prose-a:text-red-400">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
      {date && (
        <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono shrink-0 mt-0.5">
          {date}
        </span>
      )}
    </div>
  );
}

/**
 * Inner content component — exported for testing without the use(params) wrapper.
 */
export function SteerContent({ id }: { id: string }) {
  const [directive, setDirective] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directives, setDirectives] = useState<SteeringDirective[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDirectives = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/steer`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Request failed" }));
        setLoadError(json.error ?? "Request failed");
        return;
      }
      const json = await res.json();
      setDirectives(json.data?.directives ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Failed to load directives");
    }
  }, [id]);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = directive.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${id}/steer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ directive: trimmed }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? "Failed to send directive");
      } else {
        setSuccess(true);
        setDirective("");
        await fetchDirectives();
      }
    } catch {
      setError("Network error — failed to send directive");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = directive.trim().length > 0 && !submitting;

  return (
    <div className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
              Steer
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              Send directives to the team
            </p>
          </div>
        </div>
      </header>

      <p className="text-sm text-gray-500 dark:text-zinc-500 mb-6">
        Add a directive that the CTO will pick up at the next phase boundary. Stored in{" "}
        <code className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
          .redeye/steering.md
        </code>
        .
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-4"
      >
        <label
          htmlFor="steer-directive"
          className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2"
        >
          New directive
        </label>
        <textarea
          id="steer-directive"
          value={directive}
          onChange={(e) => {
            setDirective(e.target.value);
            if (success) setSuccess(false);
            if (error) setError(null);
          }}
          disabled={submitting}
          rows={3}
          placeholder="Type a directive for the CTO…"
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-md text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 resize-y"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending…" : "Send Directive"}
          </button>

          {success && (
            <span
              role="status"
              className="text-sm text-green-700 dark:text-green-400"
            >
              Directive added.
            </span>
          )}
          {error && (
            <span role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </span>
          )}
        </div>
      </form>

      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">
          Current Directives
        </h3>

        {loadError ? (
          <FetchError
            message={`Failed to load directives: ${loadError}`}
            onRetry={fetchDirectives}
          />
        ) : directives === null ? (
          <DirectivesSkeleton />
        ) : directives.length === 0 ? (
          <EmptyState
            title="No directives yet."
            subtitle="Use the form above to send your first directive to the team."
          />
        ) : (
          <div className="space-y-2">
            {directives.map((d, i) => (
              <DirectiveRow key={`${i}-${d.text}`} directive={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SteerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SteerContent id={id} />;
}
