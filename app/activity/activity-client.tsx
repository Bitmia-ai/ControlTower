"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/redesign/icon";
import { FetchError } from "@/components/fetch-error";
import { EmptyState } from "@/components/empty-state";

interface FleetActivityEntry {
  uid: string;
  projectIndex: number;
  projectName: string;
  title: string;
  details: string;
  date: string | null;
}

const POLL_INTERVAL_MS = 30_000;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ActivityClient() {
  const [entries, setEntries] = useState<FleetActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/activity");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntries((json.data as FleetActivityEntry[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <main
      style={{
        padding: "28px 28px 60px",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <div className="flex items-end justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div className="min-w-0">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Fleet
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 600,
              color: "var(--fg-0)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            Activity
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--fg-2)" }}>
            Recent shipped tasks across every project.
          </p>
        </div>
        <Link
          href="/"
          className="btn ghost sm"
          style={{ color: "var(--fg-2)" }}
        >
          <Icon name="arrowLeft" size={12} /> Home
        </Link>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ padding: "96px 0", color: "var(--fg-3)", fontSize: 14 }}
        >
          Loading activity…
        </div>
      ) : error ? (
        <FetchError message={error} onRetry={refresh} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Icon name="history" size={20} />}
          title="No activity yet"
          subtitle={
            <span>
              Once your projects start shipping tasks, they&apos;ll show up here as a
              federated feed.
            </span>
          }
        />
      ) : (
        <div
          className="card-rd"
          style={{ overflow: "hidden" }}
        >
          {entries.map((e) => (
            <Link
              key={e.uid}
              href={`/project/${e.projectIndex}/history`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 14,
                alignItems: "start",
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--mint-tint)",
                  color: "var(--mint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
                aria-hidden
              >
                <Icon name="check" size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
                  <span
                    className="font-mono"
                    style={{ fontSize: 11, color: "var(--fg-3)" }}
                  >
                    {e.projectName}
                  </span>
                  {e.date && (
                    <>
                      <span style={{ color: "var(--fg-3)" }}>·</span>
                      <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
                        {formatDate(e.date)}
                      </span>
                    </>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--fg-0)",
                    fontWeight: 500,
                    marginBottom: e.details ? 4 : 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.title}
                </div>
                {e.details && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--fg-2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.details}
                  </div>
                )}
              </div>
              <span style={{ color: "var(--fg-3)", flex: "none" }} aria-hidden>
                <Icon name="chev" size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
