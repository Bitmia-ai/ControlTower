// @vitest-environment node
/**
 * Unit tests for `upsertByKey` — the dedup helper that collapses repeated
 * stream emissions of the same `_key` (replay-on-reconnect, partial-delta
 * streams) into a single in-place update.
 *
 * Pinning this contract is load-bearing: without it, the Live tab grows N
 * identical "THINKING" cards every time ralph-loop respawns the Claude Code
 * session. Bug observed 2026-04-29: 12+ "Now we have ceo_pending: 1" rows
 * for what was a single thinking block on the model side.
 */

import { describe, it, expect } from "vitest";
import { upsertByKey } from "./live-client";
import type { ClaudeStreamEvent } from "@/lib/redeye-types";

function ev(key: string, content: string, subtype: string = "thinking"): ClaudeStreamEvent {
  return {
    type: "assistant",
    subtype,
    content,
    _key: key,
  } as ClaudeStreamEvent;
}

describe("upsertByKey", () => {
  it("appends a new event when no key collision exists", () => {
    const prev = [ev("k1", "first")];
    const next = upsertByKey(prev, ev("k2", "second"));
    expect(next).toHaveLength(2);
    expect(next[0]._key).toBe("k1");
    expect(next[1]._key).toBe("k2");
  });

  it("replaces in place when a key matches the last event (typical replay case)", () => {
    const prev = [ev("k1", "first"), ev("k2", "Now we have")];
    const next = upsertByKey(prev, ev("k2", "Now we have ceo_pending: 1 — T155 is actionable"));
    expect(next).toHaveLength(2);
    expect(next[1].content).toBe("Now we have ceo_pending: 1 — T155 is actionable");
  });

  it("replaces in place when the key matches an earlier event (full-tail replay)", () => {
    const prev = [ev("k1", "old"), ev("k2", "middle"), ev("k3", "newest")];
    const next = upsertByKey(prev, ev("k1", "updated"));
    expect(next).toHaveLength(3);
    expect(next[0].content).toBe("updated");
    expect(next[1]._key).toBe("k2");
    expect(next[2]._key).toBe("k3");
  });

  it("appends events that have no `_key` (defensive fallback — no collapse)", () => {
    const prev = [ev("k1", "first")];
    const eventNoKey = { type: "assistant", subtype: "text", content: "no key" } as ClaudeStreamEvent;
    const next = upsertByKey(prev, eventNoKey);
    expect(next).toHaveLength(2);
    // Re-running with the same keyless event must NOT collapse — they're
    // distinguishable only by reference, not key.
    const next2 = upsertByKey(next, eventNoKey);
    expect(next2).toHaveLength(3);
  });

  it("collapses repeated identical THINKING emissions to a single row", () => {
    // Reproduces the 2026-04-29 bug: ralph-loop respawn replays the same
    // thinking block 12 times. The dedup must collapse to exactly one row.
    let events: ClaudeStreamEvent[] = [];
    for (let i = 0; i < 12; i++) {
      events = upsertByKey(events, ev("thinking-block-1", "Now we have ceo_pending: 1"));
    }
    expect(events).toHaveLength(1);
    expect(events[0]._key).toBe("thinking-block-1");
  });

  it("preserves session-boundary sentinel as a single entry across replays", () => {
    const prev = [ev("k1", "first")];
    const sentinel = {
      type: "__session_boundary__",
      content: "— New session —",
      _key: "__session_boundary__",
    } as unknown as ClaudeStreamEvent;
    const next = upsertByKey(prev, sentinel);
    expect(next).toHaveLength(2);
    // Re-emit the sentinel — should not duplicate.
    const next2 = upsertByKey(next, sentinel);
    expect(next2).toHaveLength(2);
  });

  it("returns a new array reference (immutable update for React)", () => {
    const prev = [ev("k1", "first")];
    const next = upsertByKey(prev, ev("k2", "second"));
    expect(next).not.toBe(prev);
    const next2 = upsertByKey(prev, ev("k1", "updated"));
    expect(next2).not.toBe(prev);
  });
});
