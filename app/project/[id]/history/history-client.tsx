"use client";

import { useEffect, useState, useCallback, useMemo, useRef, use } from "react";
import { Clock } from "lucide-react";
import type { SessionHistoryEntry } from "@/lib/cost-history";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { SessionHistoryRow } from "@/components/history/session-history-row";
import { SectionHeader } from "@/components/section-header";
import { ListToolbar } from "@/components/list-toolbar";
import { Pagination } from "@/components/pagination";
import { useListFilter } from "@/lib/use-list-filter";

const SESSIONS_PAGE_SIZE = 10;

function SessionsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 bg-gray-100 dark:bg-zinc-800/60 rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionsWithFilter — sessions list with search + sort + pagination
// ---------------------------------------------------------------------------

function SessionsWithFilter({ sessions }: { sessions: SessionHistoryEntry[] }) {
  // Search the human-meaningful fields only — date, phase names, cost, and
  // task outcomes from iterationSummaries. The UUID filename is intentionally
  // excluded (T121 / AD-5): it's a debug artifact that the CEO never sees and
  // never wants to search by. T128 / AD-6 added the iterationSummaries path
  // so users can find a session by typing "T126" or a keyword from an outcome.
  const sessionSearchFn = useCallback(
    (entry: SessionHistoryEntry, query: string) =>
      new Date(entry.startedAt).toLocaleDateString().toLowerCase().includes(query) ||
      entry.phases.some((p) => p.toLowerCase().includes(query)) ||
      entry.cost.toFixed(2).includes(query) ||
      (entry.iterationSummaries?.some((s) =>
        s.outcome.toLowerCase().includes(query)
      ) ?? false),
    []
  );

  const sessionSortFns = useMemo(
    () => ({
      newest: (a: SessionHistoryEntry, b: SessionHistoryEntry) =>
        b.startedAt - a.startedAt,
      oldest: (a: SessionHistoryEntry, b: SessionHistoryEntry) =>
        a.startedAt - b.startedAt,
    }),
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
    items: sessions,
    pageSize: SESSIONS_PAGE_SIZE,
    defaultSort: "newest",
    searchFn: sessionSearchFn,
    sortFns: sessionSortFns,
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
        searchPlaceholder="Search by date, phase, cost, or task…"
        sortOptions={sortOptions}
        activeSort={activeSort}
        onSortChange={setSort}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      {pagedItems.length === 0 ? (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-zinc-500">
          No sessions match.{" "}
          <button
            type="button"
            onClick={resetFilters}
            className="text-red-600 dark:text-red-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div>
          {pagedItems.map((s, i) => (
            <SessionHistoryRow
              key={s.file}
              entry={s}
              // Globally descending index across pages — newest = #1.
              // Sessions arrive newest-first; offset accounts for paging.
              sessionNumber={
                filteredCount - (page - 1) * SESSIONS_PAGE_SIZE - i
              }
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={SESSIONS_PAGE_SIZE}
        totalCount={filteredCount}
      />
    </div>
  );
}

export default function HistoryPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // hasDetailRef gates the generic fetch-error banner — only show it if we have
  // never succeeded, so a transient retry doesn't wipe a previously loaded list.
  const hasLoadedRef = useRef(false);

  const fetchSessions = useCallback(async (isRetry = false) => {
    try {
      setFetchError(null);
      setSessionsError(null);
      // Clear sessions on explicit retry so the loading skeleton renders
      // instead of momentarily flashing the stale "no sessions" empty state.
      if (isRetry) setSessions(null);

      const sessionsRes = await fetch(
        `/api/projects/${id}/session-history`
      ).catch(() => null);

      hasLoadedRef.current = true;

      if (sessionsRes && sessionsRes.ok) {
        try {
          const sessionsJson = await sessionsRes.json();
          setSessions(sessionsJson?.data?.sessions ?? []);
        } catch {
          setSessionsError("Failed to parse session history.");
          setSessions([]);
        }
      } else {
        setSessionsError("Failed to load session history.");
        setSessions([]);
      }
    } catch {
      if (!hasLoadedRef.current) {
        setFetchError("Failed to load history.");
      }
    }
  }, [id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Sessions arrive sorted ascending (oldest first); display newest-first.
  const sessionsNewestFirst = sessions ? [...sessions].reverse() : null;

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto pt-6">
      {fetchError && (
        <FetchError message={fetchError} onRetry={() => fetchSessions(true)} />
      )}

      <section aria-label="Sessions" className="mt-4">
        <SectionHeader
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Sessions"
          count={sessionsNewestFirst?.length}
          className="mb-3"
        />
        {sessionsNewestFirst === null ? (
          <SessionsSkeleton />
        ) : sessionsError && sessionsNewestFirst.length === 0 ? (
          <FetchError message={sessionsError} onRetry={() => fetchSessions(true)} />
        ) : sessionsNewestFirst.length === 0 ? (
          <EmptyState
            title="No sessions found"
            subtitle="Sessions will appear here once a RedEye session has run."
          />
        ) : (
          <SessionsWithFilter sessions={sessionsNewestFirst} />
        )}
      </section>
    </main>
  );
}
