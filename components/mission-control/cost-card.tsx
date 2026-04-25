"use client";

import { useEffect, useState, useRef } from "react";
import { SparklineChart } from "./sparkline-chart";

interface CostData {
  session: number;
  total: number;
}

interface SessionEntry {
  file: string;
  cost: number;
  mtimeMs: number;
}

interface CostCardProps {
  projectId: number;
  running: boolean;
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function CostCard({ projectId, running }: CostCardProps) {
  const [data, setData] = useState<CostData | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchAll() {
    const [costData, historyData] = await Promise.all([
      fetchJsonWithTimeout<CostData>(`/api/projects/${projectId}/cost`),
      fetchJsonWithTimeout<{ sessions: SessionEntry[] }>(
        `/api/projects/${projectId}/cost-history`
      ),
    ]);

    if (costData) {
      setData(costData);
      setError(false);
    } else {
      setError(true);
    }

    // Sparkline degrades gracefully — null means just hide it
    setSessions(historyData?.sessions ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, [projectId]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (running) {
      intervalRef.current = setInterval(fetchAll, 30_000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, projectId]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-t-[3px] border-t-zinc-300 dark:border-t-zinc-700 rounded-lg p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">Cost</p>

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

          {sessions.length >= 2 && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">
                Last {sessions.length} sessions
              </p>
              <div className="text-red-500 dark:text-red-400 overflow-hidden rounded">
                <SparklineChart sessions={sessions} />
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-zinc-600">
            {error ? (
              <span>
                Failed to refresh.{" "}
                <button
                  onClick={fetchAll}
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
