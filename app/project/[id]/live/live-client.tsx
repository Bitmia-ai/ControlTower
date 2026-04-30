"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import { Terminal, UnfoldVertical, FoldVertical, ChevronsDown } from "lucide-react";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { EmptyState } from "@/components/empty-state";
import { isNearBottom } from "@/lib/scroll-utils";

const BOTTOM_THRESHOLD_PX = 80;
// Cap the in-memory event array to prevent the tab OOMing on multi-hour
// sessions. With ~5–20 events/s, 5000 events ≈ several minutes of context;
// older events scroll out of the viewport anyway.
const MAX_EVENTS_IN_MEMORY = 5000;
function bounded(events: ClaudeStreamEvent[]): ClaudeStreamEvent[] {
  return events.length > MAX_EVENTS_IN_MEMORY
    ? events.slice(events.length - MAX_EVENTS_IN_MEMORY)
    : events;
}

/**
 * Upsert by `_key`. Stream-replay-on-reconnect (each ralph-loop respawn
 * re-emits the tail of the JSONL) and partial-delta streams (each thinking-
 * token batch is the same block-id with growing content) used to append a
 * new row each time, producing dozens of identical "THINKING" cards.
 * `synthesizeKey` in lib/transcript-normalizer.ts already collapses those
 * to the same `_key`; this helper honors it. Newer content wins on
 * collision (longer thinking text, completed tool_use, etc.). Search from
 * the tail because the typical case is "the last event arrived again".
 */
export function upsertByKey(
  prev: ClaudeStreamEvent[],
  event: ClaudeStreamEvent
): ClaudeStreamEvent[] {
  const key = event._key;
  if (!key) return bounded([...prev, event]);
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i]._key === key) {
      const next = prev.slice();
      next[i] = event;
      return next;
    }
  }
  return bounded([...prev, event]);
}

interface TranscriptStatus {
  available: boolean;
  source: "redeye" | "cli" | null;
  mtime: string | null;
  ageSeconds: number | null;
}

export default function LivePageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [events, setEvents] = useState<ClaudeStreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  // 3-state toggle: null = per-card state, true = all open, false = all closed.
  // Clicking the same button twice returns to null (pass-through).
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);
  const [running, setRunning] = useState<boolean | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  // Tracks the previous `transcriptStatus.available` value so we only
  // open/close the EventSource on actual transitions. The dep array was
  // re-firing the SSE effect (and its cleanup) on every 5s poll because
  // React shallow-compares the object identity even when `available` is
  // unchanged — that tore down the connection and produced a visible
  // "Disconnected" flicker in the Live banner once a tick.
  const prevAvailableRef = useRef<boolean | null>(null);
  // Sticky-bottom: tracks whether the user is currently at/near the bottom.
  // Kept as a ref so the events-effect reads the latest value without
  // racing re-renders from scroll events.
  const isAtBottomRef = useRef(true);
  // Mirrors the ref for label rendering — only flips while autoScroll is ON.
  const [scrolledAway, setScrolledAway] = useState(false);

  const checkSessionStatus = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${id}`);
      const json = await r.json();
      const isRunning = json.data?.running === true;
      setRunning(isRunning);
      return isRunning;
    } catch {
      setRunning(false);
      return false;
    }
  }, [id]);

  const checkTranscriptStatus = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${id}/transcript-status`);
      if (!r.ok) {
        setTranscriptStatus({ available: false, source: null, mtime: null, ageSeconds: null });
        return false;
      }
      // The API returns { data: TranscriptStatus } — pull data out for the
      // common consistent response shape across routes.
      const json = await r.json();
      const status: TranscriptStatus = json?.data ?? json;
      setTranscriptStatus(status);
      return status.available;
    } catch {
      setTranscriptStatus({ available: false, source: null, mtime: null, ageSeconds: null });
      return false;
    }
  }, [id]);

  // Poll session status and transcript status every 5 seconds. The fetch
  // callbacks are not cancelled themselves — but we DO clear the interval
  // on unmount, and we read `cancelled` before any setState so a fetch
  // that resolves after unmount can't bleed into the next mount cycle's
  // state (the bug observed when the user nav'd away/back quickly).
  useEffect(() => {
    let cancelled = false;
    const safeCheckSession = async () => {
      const r = await checkSessionStatus();
      if (cancelled) return undefined;
      return r;
    };
    const safeCheckTranscript = async () => {
      const r = await checkTranscriptStatus();
      if (cancelled) return undefined;
      return r;
    };
    safeCheckSession();
    safeCheckTranscript();
    const interval = setInterval(() => {
      safeCheckSession();
      safeCheckTranscript();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkSessionStatus, checkTranscriptStatus]);

  const connect = useCallback(() => {
    // Prevent duplicate EventSources
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`/api/projects/${id}/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type === "__session_boundary__") {
          const sentinel = {
            type: "__session_boundary__",
            content: "— New session —",
            _key: parsed._key ?? "__session_boundary__",
          } as unknown as ClaudeStreamEvent;
          setEvents((prev) => upsertByKey(prev, sentinel));
          return;
        }
        const event: ClaudeStreamEvent = parsed;
        setEvents((prev) => upsertByKey(prev, event));
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      // Do NOT auto-reconnect here — the poll will reopen when available
      setConnected(false);
    };
  }, [id]);

  // Connect SSE whenever a transcript is available (regardless of running state)
  // Only act on actual `available` transitions — re-running on every 5s poll
  // re-evaluation of the same `true` flag torn down + reopened the
  // EventSource and made the "Live" pill flicker once per poll. The
  // `prevAvailableRef` short-circuit lets steady-state polls pass through
  // without touching the connection at all.
  useEffect(() => {
    if (transcriptStatus === null) return; // still loading

    const available = transcriptStatus.available;
    const prev = prevAvailableRef.current;

    if (prev === available) {
      // No transition — leave any existing EventSource alone.
      return;
    }
    prevAvailableRef.current = available;

    if (available) {
      // Only open a new connection if we don't already have one. Don't gate
      // on readyState — close() is async and readyState lags, which made
      // flapping availability accumulate orphaned EventSource objects.
      if (!esRef.current) {
        connect();
      }
    } else {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setConnected(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptStatus?.available, connect]);

  // Tear down the EventSource only on unmount. Previously this lived inside
  // the SSE-transition effect's cleanup, but that fired on every dep change
  // (i.e. every 5s poll), repeatedly closing a healthy connection.
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  // Sticky-bottom scroll tracking: observe window scroll position and
  // update the ref used by the events effect below. Also update the
  // `scrolledAway` state for button label rendering, but only while
  // autoScroll is ON (OFF means the label is always "Auto-scroll OFF").
  useEffect(() => {
    function evaluate() {
      const atBottom = isNearBottom(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
        BOTTOM_THRESHOLD_PX
      );
      isAtBottomRef.current = atBottom;
      if (autoScroll) {
        setScrolledAway(!atBottom);
      } else {
        setScrolledAway(false);
      }
    }
    evaluate();
    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, [autoScroll]);

  useEffect(() => {
    if (!autoScroll || !bottomRef.current) return;
    // Re-evaluate bottom *before* deciding, to catch the case where
    // a just-appended event grew scrollHeight enough to push us away.
    const atBottom = isNearBottom(
      window.scrollY,
      window.innerHeight,
      document.documentElement.scrollHeight,
      BOTTOM_THRESHOLD_PX
    );
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  // Determine banner text based on transcript status and running state
  function getBannerText(): string | null {
    if (!transcriptStatus) return null;
    if (!transcriptStatus.available) return null;
    if (running === true) return "Live session";
    if (transcriptStatus.source === "redeye") return "Live session";
    const age = transcriptStatus.ageSeconds ?? Infinity;
    if (age < 60) return "Live session";
    if (age < 600) return "Recent transcript";
    return "Last session";
  }

  const bannerText = getBannerText();
  const hasTranscript = transcriptStatus?.available === true;
  const isLoading = transcriptStatus === null && running === null;

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
      <header className="pt-2 pb-5 mb-4 border-b border-gray-200 dark:border-zinc-800">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-1">
          Control Tower
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
          Live
        </h1>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
          Real-time transcript of the autonomous loop
        </p>
      </header>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-green-500 animate-pulse" : "bg-gray-400 dark:bg-zinc-600"
                }`}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                {connected ? "Live" : "Disconnected"}
              </span>
            </div>

            {/* Session banner badge */}
            {bannerText && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                bannerText === "Live session"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : bannerText === "Recent transcript"
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
              }`}>
                {bannerText}
              </span>
            )}
          </div>

          {/* Toolbar actions */}
          {hasTranscript && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setForceExpanded((v) => (v === true ? null : true))}
                title="Expand all cards"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition ${
                  forceExpanded === true
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
                aria-label="Expand all"
              >
                <UnfoldVertical className="w-3.5 h-3.5" aria-hidden="true" />
                Expand all
              </button>

              <button
                onClick={() => setForceExpanded((v) => (v === false ? null : false))}
                title="Collapse all cards"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition ${
                  forceExpanded === false
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
                aria-label="Collapse all"
              >
                <FoldVertical className="w-3.5 h-3.5" aria-hidden="true" />
                Collapse all
              </button>

              <button
                onClick={() => setAutoScroll((v) => !v)}
                title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition ${
                  autoScroll
                    ? scrolledAway
                      ? "bg-yellow-500 border-yellow-500 text-white"
                      : "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
                aria-label={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
              >
                <ChevronsDown className="w-3.5 h-3.5" aria-hidden="true" />
                Auto-scroll
              </button>

              {!connected && (
                <button
                  onClick={connect}
                  className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 transition"
                >
                  Reconnect
                </button>
              )}

              <button
                onClick={() => setEvents([])}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 transition"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-gray-500 dark:text-zinc-500">Loading...</p>
        </div>
      ) : !hasTranscript && running === false ? (
        <EmptyState
          icon={<Terminal className="w-5 h-5" />}
          title="No active session"
          subtitle="Start RedEye to see live output here."
        />
      ) : (
        <>
          <TranscriptViewer events={events} forceExpanded={forceExpanded} />
          <div ref={bottomRef} />
        </>
      )}
    </main>
  );
}
