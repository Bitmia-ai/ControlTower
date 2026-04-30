"use client";

import { useEffect, useRef, useState } from "react";
import type { VelocityResult } from "@/lib/velocity";
import { VelocityChart } from "./velocity-chart";
import { fetchJsonWithTimeout } from "@/lib/fetch-utils";

interface VelocityCardProps {
  projectId: number;
  running: boolean;
}

function trendBadge(trend: VelocityResult["trend"] | undefined) {
  if (trend === "up") {
    return (
      <span
        data-testid="velocity-trend-badge"
        data-trend="up"
        className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400"
      >
        <span aria-hidden>&#8593;</span> Up
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span
        data-testid="velocity-trend-badge"
        data-trend="down"
        className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
      >
        <span aria-hidden>&#8595;</span> Down
      </span>
    );
  }
  return (
    <span
      data-testid="velocity-trend-badge"
      data-trend="stable"
      className="inline-flex items-center gap-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
    >
      <span aria-hidden>&#8594;</span> Stable
    </span>
  );
}

export function VelocityCard({ projectId, running }: VelocityCardProps) {
  const [data, setData] = useState<VelocityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchVelocity() {
    const result = await fetchJsonWithTimeout<VelocityResult>(
      `/api/projects/${projectId}/velocity`
    );
    if (result) {
      setData(result);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchVelocity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const ms = running ? 30_000 : 60_000;
    intervalRef.current = setInterval(fetchVelocity, ms);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, projectId]);

  return (
    <div
      data-testid="velocity-card"
      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-t-[3px] border-t-zinc-300 dark:border-t-zinc-700 rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
          Velocity
        </p>
        {data && trendBadge(data.trend)}
      </div>

      {loading ? (
        <div
          data-testid="velocity-loading"
          className="h-24 animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded"
        />
      ) : error && !data ? (
        <p className="text-xs text-gray-400 dark:text-zinc-600">
          Velocity data unavailable
        </p>
      ) : data ? (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
              Avg
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
              {data.avgTasksPerWeek.toFixed(1)} tasks/week
            </span>
          </div>

          <div className="text-zinc-700 dark:text-zinc-300 overflow-hidden rounded">
            <VelocityChart weeks={data.weeks} className="w-full mt-2" />
          </div>

          <div className="text-xs text-gray-400 dark:text-zinc-600">
            {running ? <span>Updates every 30s</span> : <span>Updates every 60s</span>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
