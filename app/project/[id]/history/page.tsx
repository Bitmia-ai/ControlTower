"use client";

import { useEffect, useState, useCallback, use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectDetail, ChangelogEntry } from "@/lib/redeye-types";
import { linkifyBacklogIds } from "@/components/backlog-id";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";

function TimelineEntry({ entry, projectId }: { entry: ChangelogEntry; projectId: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-red-600 flex-shrink-0 mt-1" />
        <div className="flex-1 w-px bg-gray-200 dark:bg-zinc-800 mt-1" />
      </div>

      <div className="pb-8 flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 leading-snug">
          {linkifyBacklogIds(entry.title, projectId)}
        </p>
        {entry.details && (
          <div className="text-sm text-gray-600 dark:text-zinc-400 mt-1 leading-relaxed prose prose-zinc dark:prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p>{typeof children === "string" ? linkifyBacklogIds(children, projectId) : children}</p>,
                li: ({ children }) => <li>{typeof children === "string" ? linkifyBacklogIds(children, projectId) : children}</li>,
              }}
            >
              {entry.details}
            </ReactMarkdown>
          </div>
        )}
        {entry.date && (
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">{entry.date}</p>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } catch {
      if (!detail) {
        setFetchError("Failed to load history.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, detail]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const changelog: ChangelogEntry[] = [...(detail?.recentChangelog ?? [])].reverse();

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      {loading && !detail ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading history…
        </div>
      ) : fetchError && !detail ? (
        <FetchError message={fetchError} onRetry={fetchDetail} />
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
    </main>
  );
}
