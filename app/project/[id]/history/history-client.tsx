"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import dynamic from "next/dynamic";
import { Clock, GitBranch } from "lucide-react";

// Dynamic import moves react-markdown out of the shared chunk into a lazy
// route chunk that is only fetched when the History tab is visited.
const MarkdownRenderer = dynamic(
  () => import("@/components/markdown-renderer"),
  {
    ssr: false,
    loading: () => (
      <span className="text-gray-400 dark:text-zinc-600 animate-pulse">…</span>
    ),
  }
);
import type { ProjectDetail, ChangelogEntry } from "@/lib/redeye-types";
import type { SessionHistoryEntry } from "@/lib/cost-history";
import { linkifyTaskIds } from "@/components/task-id";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { SessionHistoryRow } from "@/components/history/session-history-row";
import { SectionHeader } from "@/components/section-header";

function TimelineEntry({ entry, projectId }: { entry: ChangelogEntry; projectId: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-red-100 dark:ring-red-950/60 flex-shrink-0 mt-1" />
        <div className="flex-1 w-px bg-gray-200 dark:bg-zinc-800 mt-1.5 border-dashed" />
      </div>

      <div className="pb-8 flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 leading-snug">
          {linkifyTaskIds(entry.title, projectId)}
        </p>
        {entry.details && (
          <div className="text-sm text-gray-600 dark:text-zinc-400 mt-1 leading-relaxed prose prose-zinc dark:prose-invert prose-sm max-w-none">
            <MarkdownRenderer
              components={{
                p: ({ children }) => <p>{typeof children === "string" ? linkifyTaskIds(children, projectId) : children}</p>,
                li: ({ children }) => <li>{typeof children === "string" ? linkifyTaskIds(children, projectId) : children}</li>,
              }}
            >
              {entry.details}
            </MarkdownRenderer>
          </div>
        )}
        {entry.date && (
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">{entry.date}</p>
        )}
      </div>
    </div>
  );
}

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

export default function HistoryPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Track whether we have ever successfully loaded detail, without making
  // `detail` a useCallback dependency (which would create an infinite re-fetch
  // loop: setDetail → new detail ref → new fetchDetail → useEffect → setSessions(null) → …).
  const hasDetailRef = useRef(false);

  const fetchDetail = useCallback(async (isRetry = false) => {
    try {
      setFetchError(null);
      setSessionsError(null);
      // Clear sessions on explicit retry so the loading skeleton renders
      // instead of momentarily flashing the stale "no sessions" empty state.
      if (isRetry) setSessions(null);

      const [detailRes, sessionsRes] = await Promise.all([
        fetch(`/api/projects/${id}`).catch((e) => {
          throw e;
        }),
        fetch(`/api/projects/${id}/session-history`).catch(() => null),
      ]);

      if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`);
      const detailJson = await detailRes.json();
      if (detailJson.data) {
        setDetail(detailJson.data);
        hasDetailRef.current = true;
      }

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
      if (!hasDetailRef.current) {
        setFetchError("Failed to load history.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const changelog: ChangelogEntry[] = [...(detail?.recentChangelog ?? [])].reverse();
  // Sessions arrive sorted ascending (oldest first); display newest-first.
  const sessionsNewestFirst = sessions ? [...sessions].reverse() : null;

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
              History
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              Sessions &amp; iteration log
            </p>
          </div>
        </div>
      </header>

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
          <FetchError message={sessionsError} onRetry={() => fetchDetail(true)} />
        ) : sessionsNewestFirst.length === 0 ? (
          <EmptyState
            title="No sessions found"
            subtitle="Sessions will appear here once a RedEye session has run."
          />
        ) : (
          <div>
            {sessionsNewestFirst.map((s) => (
              <SessionHistoryRow key={s.file} entry={s} />
            ))}
          </div>
        )}
      </section>

      <div className="border-t border-gray-100 dark:border-zinc-800 my-8" />

      <section aria-label="Iteration Log" className="mt-4">
        <SectionHeader
          icon={<GitBranch className="w-3.5 h-3.5" />}
          label="Iteration Log"
          count={changelog.length > 0 ? changelog.length : undefined}
          className="mb-3"
        />
        {loading && !detail ? (
          <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
            Loading history…
          </div>
        ) : fetchError && !detail ? (
          <FetchError message={fetchError} onRetry={() => fetchDetail(true)} />
        ) : changelog.length === 0 ? (
          <EmptyState
            icon={<span>~</span>}
            title="No changelog entries yet"
            subtitle="History will appear here as features are shipped."
          />
        ) : (
          <div className="mt-2">
            {changelog.map((entry, i) => (
              <TimelineEntry key={i} entry={entry} projectId={id} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
