"use client";

import { useEffect, useState, useCallback, use } from "react";
import type { ScheduleEntry } from "@/lib/redeye-types";
import { ScheduleList } from "@/components/schedules/schedule-list";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";

function SchedulesSkeleton() {
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

/**
 * Inner content component — exported for testing without the use(params) wrapper.
 */
export function SchedulesContent({ id }: { id: string }) {
  const [schedules, setSchedules] = useState<ScheduleEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/schedules`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Request failed" }));
        setError(json.error ?? "Request failed");
        return;
      }
      const json = await res.json();
      setSchedules(json.data?.schedules ?? []);
      setError(null);
    } catch {
      setError("Failed to load schedules");
    }
  }, [id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <div className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
          Scheduled Tasks
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
          Recurring tasks defined in{" "}
          <code className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">
            .redeye/schedules.md
          </code>
        </p>
      </div>

      {error ? (
        <FetchError
          message={`Failed to load schedules: ${error}`}
          onRetry={fetchSchedules}
        />
      ) : schedules === null ? (
        <SchedulesSkeleton />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No schedules defined"
          subtitle="Add recurring tasks to .redeye/schedules.md to see them here."
        />
      ) : (
        <ScheduleList schedules={schedules} />
      )}
    </div>
  );
}

export default function SchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SchedulesContent id={id} />;
}
