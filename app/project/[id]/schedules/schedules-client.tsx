"use client";

import { useEffect, useState, useCallback, use } from "react";
import type { ScheduleEntry } from "@/lib/redeye-types";
import { ScheduleList } from "@/components/schedules/schedule-list";
import { AddScheduleDialog } from "@/components/schedules/add-schedule-dialog";
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
  const [addOpen, setAddOpen] = useState(false);

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

  const count = schedules?.length ?? 0;

  return (
    <div className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      <header className="pt-2 pb-5 mb-6 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
              Control Tower
            </p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
              Schedules
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              {schedules === null
                ? "Loading scheduled tasks…"
                : `${count} scheduled ${count === 1 ? "task" : "tasks"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition min-h-[44px]"
          >
            + Add Schedule
          </button>
        </div>
      </header>

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
          subtitle="Add a recurring task to get started."
          action={{ label: "+ Add Schedule", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <ScheduleList schedules={schedules} projectId={id} />
      )}

      <AddScheduleDialog
        projectId={id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={fetchSchedules}
      />
    </div>
  );
}

export default function SchedulesPageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SchedulesContent id={id} />;
}
