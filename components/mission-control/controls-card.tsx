"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, PlusCircle } from "lucide-react";

interface ControlsCardProps {
  running: boolean;
  stalled?: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onSteer?: () => void;
  onAddBacklog?: () => void;
  onRestart?: () => void;
  onForceStop?: () => void;
}

type PendingAction = "stop" | "pause" | "force-stop" | null;


export function ControlsCard({
  running,
  stalled,
  onStart,
  onStop,
  onPause,
  onSteer,
  onAddBacklog,
  onRestart,
  onForceStop,
}: ControlsCardProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [captionVisible, setCaptionVisible] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [forceConfirmPending, setForceConfirmPending] = useState(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      if (captionTimer.current) clearTimeout(captionTimer.current);
      if (forceConfirmTimer.current) clearTimeout(forceConfirmTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setForceConfirmPending(false);
        if (forceConfirmTimer.current) {
          clearTimeout(forceConfirmTimer.current);
          forceConfirmTimer.current = null;
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setForceConfirmPending(false);
        if (forceConfirmTimer.current) {
          clearTimeout(forceConfirmTimer.current);
          forceConfirmTimer.current = null;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dropdownOpen]);

  function triggerFeedback(kind: "stop" | "pause") {
    setPending(kind);
    setCaptionVisible(true);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    pendingTimer.current = setTimeout(() => setPending(null), 3000);
    captionTimer.current = setTimeout(() => setCaptionVisible(false), 5000);
  }

  function handleStop() {
    setDropdownOpen(false);
    setForceConfirmPending(false);
    if (forceConfirmTimer.current) {
      clearTimeout(forceConfirmTimer.current);
      forceConfirmTimer.current = null;
    }
    triggerFeedback("stop");
    onStop?.();
  }

  function handlePause() {
    triggerFeedback("pause");
    onPause?.();
  }

  function handleChevronClick() {
    setDropdownOpen((o) => !o);
    setForceConfirmPending(false);
    if (forceConfirmTimer.current) {
      clearTimeout(forceConfirmTimer.current);
      forceConfirmTimer.current = null;
    }
  }

  function handleForceStopMenuClick() {
    if (!forceConfirmPending) {
      setForceConfirmPending(true);
      if (forceConfirmTimer.current) clearTimeout(forceConfirmTimer.current);
      forceConfirmTimer.current = setTimeout(() => {
        setForceConfirmPending(false);
        forceConfirmTimer.current = null;
      }, 4000);
      return;
    }
    // Confirmed — execute force stop
    setForceConfirmPending(false);
    if (forceConfirmTimer.current) {
      clearTimeout(forceConfirmTimer.current);
      forceConfirmTimer.current = null;
    }
    setDropdownOpen(false);
    setPending("force-stop");
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPending(null), 3000);
    onForceStop?.();
  }

  const stopLabel = pending === "stop"
    ? "Stopping…"
    : pending === "force-stop"
    ? "Force Stopping…"
    : "Stop";
  const pauseLabel = pending === "pause" ? "Pausing…" : "Pause";
  const forceStopping = pending === "force-stop";

  return (
    <div className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-t-[3px] ${stalled ? "border-t-amber-500" : "border-t-zinc-300 dark:border-t-zinc-700"} rounded-lg p-5 h-full`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500 mb-4">
        Controls
      </p>

      {stalled && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
          ⚠ Session stalled — no output for 10 minutes
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <button
              onClick={onStart}
              className="flex-1 min-h-[44px] px-3 py-2 text-sm font-medium bg-green-700 hover:bg-green-600 text-white rounded-md transition"
            >
              Start
            </button>
          ) : (
            <>
              <div ref={dropdownRef} className="flex-1 relative flex">
                <button
                  onClick={handleStop}
                  disabled={pending === "stop" || forceStopping}
                  className="flex-1 min-h-[44px] px-3 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-l-md transition"
                >
                  {stopLabel}
                </button>
                <button
                  onClick={handleChevronClick}
                  disabled={forceStopping}
                  aria-label="More stop options"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  className="min-h-[44px] px-2 py-2 text-sm font-medium bg-red-700 hover:bg-red-600 disabled:bg-red-900 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-r-md border-l border-red-600 transition flex items-center justify-center"
                >
                  <ChevronDown size={14} />
                </button>
                {dropdownOpen && !forceStopping && (
                  <div
                    role="menu"
                    className="absolute top-full left-0 right-0 mt-1 z-10 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg overflow-hidden"
                  >
                    {!forceConfirmPending ? (
                      <button
                        role="menuitem"
                        onClick={handleForceStopMenuClick}
                        className="w-full min-h-[44px] px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      >
                        Force Stop
                      </button>
                    ) : (
                      <button
                        role="menuitem"
                        onClick={handleForceStopMenuClick}
                        className="w-full min-h-[44px] px-3 py-2 text-sm text-left font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      >
                        Confirm hard kill — click again
                      </button>
                    )}
                  </div>
                )}
              </div>
              {stalled ? (
                <button
                  onClick={onRestart}
                  disabled={forceStopping}
                  className="flex-1 min-h-[44px] px-3 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md transition"
                >
                  Restart
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  disabled={pending === "pause" || forceStopping}
                  className="flex-1 min-h-[44px] px-3 py-2 text-sm font-medium bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 dark:text-zinc-200 rounded-md transition"
                >
                  {pauseLabel}
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSteer}
            className="flex-1 min-h-[44px] px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-md border border-gray-200 dark:border-zinc-700 transition"
          >
            Steer
          </button>
          <button
            onClick={onAddBacklog}
            aria-label="Add item to backlog"
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200 dark:border-indigo-800 transition"
          >
            <PlusCircle size={14} />
            Add to Backlog
          </button>
        </div>

        {captionVisible && (
          <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
            Directive sent — team will finish current phase.
          </p>
        )}
      </div>
    </div>
  );
}
