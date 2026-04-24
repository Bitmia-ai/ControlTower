"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { isNearBottom } from "@/lib/scroll-utils";

const BOTTOM_THRESHOLD_PX = 80;

interface TranscriptStatus {
  available: boolean;
  source: "redeye" | "cli" | null;
  mtime: string | null;
  ageSeconds: number | null;
}

export default function LivePage({
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
      const status: TranscriptStatus = await r.json();
      setTranscriptStatus(status);
      return status.available;
    } catch {
      setTranscriptStatus({ available: false, source: null, mtime: null, ageSeconds: null });
      return false;
    }
  }, [id]);

  // Poll session status and transcript status every 5 seconds
  useEffect(() => {
    checkSessionStatus();
    checkTranscriptStatus();
    const interval = setInterval(() => {
      checkSessionStatus();
      checkTranscriptStatus();
    }, 5000);
    return () => clearInterval(interval);
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
        // Handle session boundary sentinel
        if (parsed.type === "__session_boundary__") {
          setEvents((prev) => [
            ...prev,
            { type: "__session_boundary__", content: "— New session —" } as unknown as ClaudeStreamEvent,
          ]);
          return;
        }
        const event: ClaudeStreamEvent = parsed;
        setEvents((prev) => [...prev, event]);
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
  useEffect(() => {
    if (transcriptStatus === null) return; // still loading

    if (transcriptStatus.available) {
      // Only open a new connection if we don't already have one
      if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
        connect();
      }
    } else {
      // Close connection when no transcript is available
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setConnected(false);
      }
    }

    return () => {
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptStatus?.available, connect]);

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-medium text-gray-600 dark:text-zinc-400">Live Transcript</h2>

        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-green-500 animate-pulse" : "bg-gray-400 dark:bg-zinc-600"
              }`}
            />
            <span className="text-xs text-gray-500 dark:text-zinc-500">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>

          {hasTranscript && (
            <>
              <button
                onClick={() => setAutoScroll((v) => !v)}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  autoScroll
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
              >
                {autoScroll
                  ? scrolledAway
                    ? "Auto-scroll paused"
                    : "Auto-scroll ON"
                  : "Auto-scroll OFF"}
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
                onClick={() => setForceExpanded((v) => (v === true ? null : true))}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  forceExpanded === true
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
              >
                Expand all
              </button>

              <button
                onClick={() => setForceExpanded((v) => (v === false ? null : false))}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${
                  forceExpanded === false
                    ? "bg-red-600 border-red-600 text-white"
                    : "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
              >
                Collapse all
              </button>

              <button
                onClick={() => setEvents([])}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 transition"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-gray-500 dark:text-zinc-500">Loading...</p>
        </div>
      ) : !hasTranscript && running === false ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
            <span className="text-gray-500 dark:text-zinc-500 text-lg">~</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            No active session. Start RedEye to see live output.
          </p>
        </div>
      ) : (
        <>
          <TranscriptViewer events={events} forceExpanded={forceExpanded} />
          <div ref={bottomRef} />
        </>
      )}
    </main>
  );
}
