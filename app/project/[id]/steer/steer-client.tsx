"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import dynamic from "next/dynamic";
import { Pencil, Trash2, Send, Radio } from "lucide-react";

// Dynamic import moves react-markdown out of the shared chunk into a lazy
// route chunk that is only fetched when the Steer page is visited.
const MarkdownRenderer = dynamic(
  () => import("@/components/markdown-renderer"),
  {
    ssr: false,
    loading: () => (
      <span className="text-gray-400 dark:text-zinc-600 animate-pulse">…</span>
    ),
  }
);
import type { SteeringDirective } from "@/lib/redeye-types";
import { FetchError } from "@/components/fetch-error";
import { ListToolbar } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { useListFilter } from "@/lib/use-list-filter";

const DIRECTIVES_PAGE_SIZE = 20;
const MAX_DIRECTIVE_CHARS = 2000;

function DirectivesSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 bg-gray-100 dark:bg-zinc-800/60 rounded-lg animate-pulse"
        />
      ))}
    </div>
  );
}

type RowMode = "view" | "editing" | "confirm-delete";

function DirectiveRow({
  directive,
  index,
  projectId,
  onChanged,
}: {
  directive: SteeringDirective;
  index: number;
  projectId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<RowMode>("view");
  const [editText, setEditText] = useState(directive.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract trailing date in parens if present, e.g. "Focus on UX (2026-04-25)"
  // [\s\S] (instead of `.` with the `s` flag) so multi-line markdown directives
  // still get the trailing date stripped.
  const match = directive.text.match(/^([\s\S]*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$/);
  const rawText = match ? match[1] : directive.text;
  const text = rawText.replace(/^\n+/, "");
  const date = match ? match[2] : directive.timestamp;

  // Zero-padded ordinal for the mission-briefing aesthetic
  const ordinal = String(index + 1).padStart(2, "0");

  const startEdit = () => {
    setEditText(directive.text);
    setError(null);
    setMode("editing");
  };

  const cancel = () => {
    setError(null);
    setMode("view");
  };

  const handleSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/steer`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index, text: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to save directive");
      } else {
        setMode("view");
        await onChanged();
      }
    } catch {
      setError("Network error — failed to save directive");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/steer`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to delete directive");
      } else {
        await onChanged();
        // Row will be removed by the parent on refetch; no need to reset mode.
      }
    } catch {
      setError("Network error — failed to delete directive");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "editing") {
    return (
      <div
        data-testid={`directive-row-${index}`}
        className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-zinc-900 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
          <span className="font-mono text-xs font-bold text-red-400 dark:text-red-600 select-none">
            {ordinal}
          </span>
          <span className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">
            Editing
          </span>
        </div>
        <div className="p-4">
          <label className="sr-only" htmlFor={`directive-edit-${index}`}>
            Edit directive
          </label>
          <textarea
            id={`directive-edit-${index}`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            disabled={busy}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-md text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 resize-y font-mono"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || editText.trim().length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded transition disabled:opacity-50 min-h-[44px]"
            >
              Cancel
            </button>
            {error && (
              <span role="alert" className="text-xs text-red-700 dark:text-red-400">
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`directive-row-${index}`}
      className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start gap-0">
        {/* Ordinal gutter */}
        <div className="flex-none w-12 flex items-start justify-center pt-3.5 pb-3 border-r border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40">
          <span className="font-mono text-xs font-bold text-gray-300 dark:text-zinc-600 select-none leading-none">
            {ordinal}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none break-words text-gray-900 dark:text-zinc-100 prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-a:text-red-600 dark:prose-a:text-red-400">
            <MarkdownRenderer>{text}</MarkdownRenderer>
          </div>
          {date && (
            <p className="mt-1.5 font-mono text-[11px] text-gray-400 dark:text-zinc-600">
              {date}
            </p>
          )}

          {mode === "confirm-delete" && (
            <div
              data-testid={`directive-delete-confirm-${index}`}
              className="mt-3 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3"
            >
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Delete this directive?
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
                This removes it from{" "}
                <code className="font-mono">.redeye/steering.md</code>.
              </p>
              <div className="flex gap-2 mt-2.5 items-center">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition disabled:opacity-50 min-h-[44px]"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded transition disabled:opacity-50 min-h-[44px]"
                >
                  Cancel
                </button>
                {error && (
                  <span role="alert" className="text-xs text-red-700 dark:text-red-400">
                    {error}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions column — always visible */}
        <div className="flex-none flex flex-col items-center gap-1 px-2 pt-2.5 pb-2 border-l border-gray-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit directive ${index + 1}`}
            title="Edit directive"
            className="text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("confirm-delete");
            }}
            aria-label={`Delete directive ${index + 1}`}
            title="Delete directive"
            className="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectivesFilter — filtered + paginated list of directives
// ---------------------------------------------------------------------------

type IndexedDirective = SteeringDirective & { _idx: number };

function DirectivesFilter({
  directives,
  projectId,
  onChanged,
}: {
  directives: SteeringDirective[];
  projectId: string;
  onChanged: () => void | Promise<void>;
}) {
  // Attach original indices so PATCH/DELETE calls use the correct index
  const indexedDirectives = useMemo<IndexedDirective[]>(
    () => directives.map((d, i) => ({ ...d, _idx: i })),
    [directives]
  );

  const sortFns = useMemo(
    () => ({
      newest: (a: IndexedDirective, b: IndexedDirective) => b._idx - a._idx,
      oldest: (a: IndexedDirective, b: IndexedDirective) => a._idx - b._idx,
    }),
    []
  );

  const searchFn = useCallback(
    (item: IndexedDirective, query: string) =>
      item.text.toLowerCase().includes(query),
    []
  );

  const {
    pagedItems,
    page,
    setPage,
    pageCount,
    totalCount,
    filteredCount,
    searchQuery,
    setSearchQuery,
    activeSort,
    setSort,
    resetFilters,
  } = useListFilter({
    items: indexedDirectives,
    pageSize: DIRECTIVES_PAGE_SIZE,
    defaultSort: "newest",
    searchFn,
    sortFns,
  });

  const sortOptions = useMemo(
    () => [
      { key: "newest", label: "Newest first" },
      { key: "oldest", label: "Oldest first" },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search directives…"
        sortOptions={sortOptions}
        activeSort={activeSort}
        onSortChange={setSort}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      {pagedItems.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
          No directives match.{" "}
          <button
            type="button"
            onClick={resetFilters}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {pagedItems.map((d) => (
            <DirectiveRow
              key={`${d._idx}-${d.text}`}
              directive={d}
              index={d._idx}
              projectId={projectId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={DIRECTIVES_PAGE_SIZE}
        totalCount={filteredCount}
      />
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

  const charCount = directive.length;
  const charNearLimit = charCount > MAX_DIRECTIVE_CHARS * 0.8;
  const charOverLimit = charCount > MAX_DIRECTIVE_CHARS;
  const canSubmit = directive.trim().length > 0 && !submitting && !charOverLimit;

  const directiveCount = directives?.length ?? null;

  return (
    <div className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      {/* Compose card — elevated with left accent border */}
      <section
        aria-label="Send a new directive"
        className="mb-8 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm"
      >
        {/* Card header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40">
          <Radio size={14} className="text-red-500 dark:text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 leading-none">
              New Directive
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
              Picked up by the CTO at the next phase boundary ·{" "}
              <code className="font-mono text-[11px] bg-gray-200 dark:bg-zinc-700 px-1 py-0.5 rounded">
                .redeye/steering.md
              </code>
            </p>
          </div>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-4">
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
            placeholder="e.g. Focus on fixing the auth bug before anything else…"
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-md text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 resize-y"
          />

          {/* Footer row: char count left, submit right */}
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {charCount > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    charOverLimit
                      ? "text-red-600 dark:text-red-400 font-semibold"
                      : charNearLimit
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-400 dark:text-zinc-600"
                  }`}
                >
                  {charCount}/{MAX_DIRECTIVE_CHARS}
                </span>
              )}
              {success && (
                <span role="status" className="text-sm text-green-700 dark:text-green-400">
                  Directive added.
                </span>
              )}
              {error && (
                <span role="alert" className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={13} />
              {submitting ? "Sending…" : "Send Directive"}
            </button>
          </div>
        </form>
      </section>

      {/* Active directives section */}
      <div>
        {/* Section header with live count */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
            Active Directives
          </h2>
          {directiveCount !== null && directiveCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              {directiveCount}
            </span>
          )}
        </div>

        {loadError ? (
          <FetchError
            message={`Failed to load directives: ${loadError}`}
            onRetry={fetchDirectives}
          />
        ) : directives === null ? (
          <DirectivesSkeleton />
        ) : directives.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
              <Radio size={18} className="text-gray-400 dark:text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              No directives yet.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
              Use the form above to send your first directive to the team.
            </p>
          </div>
        ) : (
          <DirectivesFilter
            directives={directives}
            projectId={id}
            onChanged={fetchDirectives}
          />
        )}
      </div>
    </div>
  );
}

export default function SteerPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SteerContent id={id} />;
}
