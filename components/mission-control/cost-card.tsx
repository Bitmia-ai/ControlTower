"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CostTrendChart } from "./cost-trend-chart";
import { fetchJsonWithTimeout } from "@/lib/fetch-utils";

interface CostData {
  session: number;
  total: number;
}

interface SessionEntry {
  file: string;
  cost: number;
  mtimeMs: number;
}

interface ProjectedPoint {
  sessionIndex: number;
  cost: number;
}

interface ForecastData {
  sessions: SessionEntry[];
  burnRatePerSession: number;
  trend: "accelerating" | "decelerating" | "stable";
  forecast24h: number;
  forecast7d: number;
  sessionsPerDay: number;
  projectedSessions: ProjectedPoint[];
}

interface CostCardProps {
  projectId: number;
  running: boolean;
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function trendColorClass(trend: ForecastData["trend"] | undefined): string {
  if (trend === "accelerating") return "text-amber-500 dark:text-amber-400";
  if (trend === "decelerating") return "text-green-500 dark:text-green-400";
  return "text-gray-900 dark:text-zinc-100";
}

function TrendIcon({ trend }: { trend: ForecastData["trend"] }) {
  const cls = "w-3.5 h-3.5";
  if (trend === "accelerating")
    return <TrendingUp data-testid="trend-icon-up" className={cls} aria-hidden />;
  if (trend === "decelerating")
    return (
      <TrendingDown data-testid="trend-icon-down" className={cls} aria-hidden />
    );
  return <Minus data-testid="trend-icon-stable" className={cls} aria-hidden />;
}

export function CostCard({ projectId, running }: CostCardProps) {
  const [data, setData] = useState<CostData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchAll() {
    const [costData, forecastData] = await Promise.all([
      fetchJsonWithTimeout<CostData>(`/api/projects/${projectId}/cost`),
      fetchJsonWithTimeout<ForecastData>(
        `/api/projects/${projectId}/cost-forecast`
      ),
    ]);

    if (costData) {
      setData(costData);
      setError(false);
    } else {
      setError(true);
    }

    // Forecast degrades gracefully — null means just hide the new sections
    setForecast(forecastData);

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

  const sessions = forecast?.sessions ?? [];
  const showForecast =
    forecast !== null &&
    forecast.burnRatePerSession > 0 &&
    forecast.sessionsPerDay > 0;
  const showBurnRate =
    forecast !== null && forecast.burnRatePerSession > 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-t-[3px] border-t-zinc-300 dark:border-t-zinc-700 rounded-lg p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-3">Cost</p>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* T067: Stack session/total rows vertically for the 300px right rail. */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                Session
              </span>
              <span className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                {data ? formatCost(data.session) : "—"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                Total
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                {data ? formatCost(data.total) : "—"}
              </span>
            </div>
          </div>

          {showBurnRate && forecast && (
            <div
              data-testid="burn-rate-row"
              className="flex items-baseline justify-between pt-2 border-t border-gray-100 dark:border-zinc-800"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                Burn Rate
              </span>
              <span
                className={`flex items-center gap-1 text-sm font-medium ${trendColorClass(forecast.trend)}`}
              >
                <TrendIcon trend={forecast.trend} />
                {formatCost(forecast.burnRatePerSession)}/session
              </span>
            </div>
          )}

          {showForecast && forecast && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                  Est. 24h
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {formatCost(forecast.forecast24h)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">
                  Est. 7d
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {formatCost(forecast.forecast7d)}
                </span>
              </div>
            </div>
          )}

          {sessions.length >= 2 && forecast && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-1">
                Last {sessions.length} sessions + 5 projected
              </p>
              <div className="text-red-500 dark:text-red-400 overflow-hidden rounded">
                <CostTrendChart
                  sessions={sessions}
                  projectedSessions={forecast.projectedSessions}
                />
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
