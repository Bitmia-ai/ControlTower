/**
 * In-memory registry of connected Radios.
 *
 * Phase 3 v0: single-instance, in-memory map keyed by radio_id. The
 * supervisor in `lib/radio/server.ts` populates this on Welcome and
 * removes on disconnect. Adapters look up "the current Radio" — for
 * v0 we expose `current()` which returns the first connected Radio.
 * Multi-Radio routing lands in Phase 4 alongside the surface-ID work.
 */

import type { RadioConnection } from "./client";

const KEY = "__ct_radio_registry_v1" as const;

interface Registry {
  byId: Map<string, RadioConnection>;
}

const g = globalThis as unknown as Record<string, Registry | undefined>;

function init(): Registry {
  if (!g[KEY]) {
    g[KEY] = { byId: new Map() };
  }
  return g[KEY]!;
}

export function register(conn: RadioConnection): void {
  init().byId.set(conn.radioId, conn);
}

export function unregister(radioId: string): void {
  init().byId.delete(radioId);
}

export function get(radioId: string): RadioConnection | undefined {
  return init().byId.get(radioId);
}

export function list(): RadioConnection[] {
  return [...init().byId.values()];
}

/**
 * Phase 3 v0: pick "the" Radio. Returns the first non-closed
 * connection. Multi-Radio routing arrives in Phase 4 (caller passes
 * a `radio_id` that maps to a specific connection).
 */
export function current(): RadioConnection | undefined {
  for (const c of init().byId.values()) {
    if (!c.isClosed()) return c;
  }
  return undefined;
}
