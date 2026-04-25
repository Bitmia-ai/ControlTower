"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";

// Mono uppercase eyebrow used as the per-card identity label. Matches the
// CARD-LABEL token used across the rest of the precision-instrument design
// system (SectionHeader, page eyebrows). Color is layered on per card type.
const CARD_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.18em]";

/**
 * Walk backwards from `index - 1` looking for the nearest assistant/tool_use
 * event, returning its `tool_name`. Stops and returns null if another
 * `tool_result` is encountered first (that tool_result's pairing sits between
 * us and the tool_use, so the match would be wrong).
 *
 * Exported as a pure helper so it can be unit-tested without mounting React.
 */
export function findPrecedingToolName(
  events: ClaudeStreamEvent[],
  index: number
): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "user" && ev.subtype === "tool_result") {
      return null;
    }
    if (ev.type === "assistant" && ev.subtype === "tool_use") {
      return ev.tool_name ?? null;
    }
  }
  return null;
}

function firstNonEmptyLine(content: string | undefined, max = 80): string {
  if (!content) return "";
  const line = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > max ? line.slice(0, max) + "…" : line;
}

/**
 * When `forceOpen` is true/false, the card's open state is overridden by the
 * parent (Expand all / Collapse all). When null, the card manages its own
 * state via a click toggle.
 */
function useOpenState(forceOpen: boolean | null) {
  const [open, setOpen] = useState(false);
  // Sync local state whenever the parent overrides via forceOpen. This makes
  // "Collapse All" / "Expand All" sticky: when the parent later returns to
  // `null` (per-card mode), each card retains the most recent forced value
  // instead of snapping back to whatever the user had toggled before.
  useEffect(() => {
    if (forceOpen !== null) {
      setOpen(forceOpen);
    }
  }, [forceOpen]);
  const effectiveOpen = forceOpen === null ? open : forceOpen;
  return { open: effectiveOpen, toggle: () => setOpen((v) => !v) };
}

function ToolUseCard({
  event,
  forceOpen,
}: {
  event: ClaudeStreamEvent;
  forceOpen: boolean | null;
}) {
  const { open, toggle } = useOpenState(forceOpen);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-indigo-500/60 dark:border-l-indigo-400/50 rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        aria-label={open ? "Collapse tool call" : "Expand tool call"}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <span className={`${CARD_LABEL} text-indigo-600 dark:text-indigo-400`}>tool call</span>
        <span className="text-xs font-mono text-indigo-700 dark:text-indigo-300 ml-1">
          {event.tool_name ?? "tool_use"}
        </span>
      </button>
      {open && event.tool_input && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-zinc-800">
          <pre className="text-xs text-gray-700 dark:text-zinc-300 font-mono overflow-x-auto mt-2 whitespace-pre-wrap break-all">
            {JSON.stringify(event.tool_input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultCard({
  event,
  toolName,
  forceOpen,
}: {
  event: ClaudeStreamEvent;
  toolName: string | null;
  forceOpen: boolean | null;
}) {
  const { open, toggle } = useOpenState(forceOpen);
  const label = toolName ?? "tool result";
  const preview = firstNonEmptyLine(event.content);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-cyan-500/50 dark:border-l-cyan-400/40 rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        aria-label={open ? `Collapse ${label} result` : `Expand ${label} result`}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <span className={`${CARD_LABEL} text-cyan-600 dark:text-cyan-400`}>result</span>
        <span className="text-xs font-mono text-cyan-700 dark:text-cyan-300 ml-1">{label}</span>
        {preview && (
          <span className="text-xs text-gray-500 dark:text-zinc-500 truncate ml-2 font-mono">
            {preview}
          </span>
        )}
      </button>
      {open && event.content && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-zinc-800">
          <pre className="text-xs text-gray-700 dark:text-zinc-300 font-mono overflow-x-auto mt-2 whitespace-pre-wrap break-all">
            {event.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ThinkingCard({
  event,
  forceOpen,
}: {
  event: ClaudeStreamEvent;
  forceOpen: boolean | null;
}) {
  const { open, toggle } = useOpenState(forceOpen);
  const preview = firstNonEmptyLine(event.content);
  return (
    <div className="bg-violet-50/40 dark:bg-violet-950/15 border border-violet-200/60 dark:border-violet-900/50 border-l-2 border-l-violet-500/60 dark:border-l-violet-400/50 rounded-xl overflow-hidden">
      <button
        onClick={toggle}
        aria-label={open ? "Collapse thinking" : "Expand thinking"}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-violet-100/40 dark:hover:bg-violet-900/20 transition"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-violet-400 dark:text-violet-500 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <span className={`${CARD_LABEL} text-violet-600 dark:text-violet-400`}>
          Thinking…
        </span>
        {preview && (
          <span className="text-xs text-violet-600/70 dark:text-violet-400/70 truncate ml-2 italic">
            {preview}
          </span>
        )}
      </button>
      {open && event.content && (
        <div className="px-4 pb-3 border-t border-violet-200/60 dark:border-violet-900/40">
          <p className="text-sm text-violet-900/80 dark:text-violet-200/90 whitespace-pre-wrap mt-2 leading-relaxed italic">
            {event.content}
          </p>
        </div>
      )}
    </div>
  );
}

function AssistantTextCard({ event }: { event: ClaudeStreamEvent }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-red-500 rounded-xl px-4 py-3.5 shadow-sm">
      <p className={`${CARD_LABEL} text-red-600 dark:text-red-400 mb-1.5`}>Claude</p>
      {event.content && (
        <p className="text-[15px] text-gray-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
          {event.content}
        </p>
      )}
    </div>
  );
}

function ResultCard({ event }: { event: ClaudeStreamEvent }) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-zinc-400 dark:border-l-zinc-600 rounded-xl px-4 py-3">
      <p className={`${CARD_LABEL} text-gray-500 dark:text-zinc-400 mb-2`}>
        Session Result
      </p>
      {event.content && (
        <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2 leading-relaxed">
          {event.content}
        </p>
      )}
      {event.usage && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-zinc-500 font-mono tabular-nums">
          <span>In: {event.usage.input_tokens.toLocaleString()}</span>
          <span>Out: {event.usage.output_tokens.toLocaleString()}</span>
          {event.usage.cache_read_input_tokens != null && (
            <span>
              Cache: {event.usage.cache_read_input_tokens.toLocaleString()}
            </span>
          )}
        </div>
      )}
      {event.cost != null && (
        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 font-mono tabular-nums">
          Cost: ${event.cost.toFixed(4)}
        </p>
      )}
    </div>
  );
}

export function TranscriptViewer({
  events,
  forceExpanded = null,
}: {
  events: ClaudeStreamEvent[];
  /**
   * Global override for tool card open state: true = all open, false = all
   * closed, null = each card manages its own state.
   */
  forceExpanded?: boolean | null;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-600 py-8 text-center">
        No events yet…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event, i) => {
        // Session boundary separator — emitted when the tailed file switches
        if ((event.type as string) === "__session_boundary__") {
          return (
            <div key={i} className="flex items-center gap-3 py-2 my-1">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
              <span className={`${CARD_LABEL} shrink-0 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400`}>
                New session
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
            </div>
          );
        }

        if (event.type === "result") {
          return <ResultCard key={i} event={event} />;
        }

        if (event.type === "assistant") {
          if (event.subtype === "tool_use") {
            return <ToolUseCard key={i} event={event} forceOpen={forceExpanded} />;
          }

          if (event.subtype === "thinking") {
            return <ThinkingCard key={i} event={event} forceOpen={forceExpanded} />;
          }

          return <AssistantTextCard key={i} event={event} />;
        }

        if (event.type === "user" && event.subtype === "tool_result") {
          return (
            <ToolResultCard
              key={i}
              event={event}
              toolName={findPrecedingToolName(events, i)}
              forceOpen={forceExpanded}
            />
          );
        }

        // Suppress plain user messages (the harness-injected initial prompt).
        // Only user/tool_result events render (handled above).
        if (event.type === "user") {
          return null;
        }

        return (
          <div
            key={i}
            className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-zinc-300 dark:border-l-zinc-700 rounded-xl px-4 py-2"
          >
            <p className={`${CARD_LABEL} text-gray-400 dark:text-zinc-600 mb-0.5`}>
              {event.type}
            </p>
            {event.content && (
              <p className="text-sm text-gray-500 dark:text-zinc-500 leading-relaxed whitespace-pre-wrap">
                {event.content}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
