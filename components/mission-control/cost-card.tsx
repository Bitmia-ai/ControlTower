"use client";

import { useEffect, useState, useRef } from "react";

interface CostData {
  session: number;
  total: number;
}

interface CostCardProps {
  projectId: number;
  running: boolean;
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function CostCard({ projectId, running }: CostCardProps) {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchCost() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`/api/projects/${projectId}/cost`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setData(json.data as CostData);
        setError(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCost();
  }, [projectId]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (running) {
      intervalRef.current = setInterval(fetchCost, 30_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, projectId]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-3">Cost</p>

      {loading ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="h-4 w-40 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                {data ? formatCost(data.session) : "—"}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-500">this session (est.)</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-gray-200 dark:bg-zinc-700 self-center" />
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {data ? formatCost(data.total) : "—"}
              </span>
              <span className="text-xs text-gray-500 dark:text-zinc-500">total (est.)</span>
            </div>
          </div>

          <div className="text-xs text-gray-400 dark:text-zinc-600">
            {error ? (
              <span>
                Failed to refresh.{" "}
                <button
                  onClick={fetchCost}
                  className="underline hover:text-gray-600 dark:hover:text-zinc-400"
                >
                  Retry
                </button>
              </span>
            ) : running ? (
              <span>Updates every 30s</span>
            ) : (
              <span>Session ended</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
