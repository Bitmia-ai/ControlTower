/**
 * Composition root — single source of truth for the abstractions used
 * by API routes. Routes import `getStore()`, `getSessionDriver()`,
 * `getTranscriptSource()`; never the underlying lib/redeye-files.ts /
 * lib/session-manager.ts modules directly.
 *
 * Phase 1: Local* adapters wrap the existing in-process modules.
 * Phase 3: STORE=radio routes through Radio* adapters that talk to a
 *          connected Radio over WSS. If no Radio is connected when an
 *          API call lands, we transparently fall back to Local so the
 *          UI still works (operator visibility via /api/notifications
 *          or daemon.status).
 *
 * The `globalThis` singleton trick survives Next.js HMR module
 * reloads in dev — without it, dev-mode hot-reload would break the
 * in-memory session map every time you save a file.
 */

import { LocalProjectStore } from "@/lib/store/local";
import { RadioProjectStore } from "@/lib/store/radio";
import type { ProjectStore } from "@/lib/store";
import { LocalSessionDriver } from "@/lib/sessions/local";
import { RadioSessionDriver } from "@/lib/sessions/radio";
import type { SessionDriver } from "@/lib/sessions";
import { LocalTranscriptSource } from "@/lib/transcript/local";
import { RadioTranscriptSource } from "@/lib/transcript/radio";
import type { TranscriptSource } from "@/lib/transcript";
import * as radioRegistry from "@/lib/radio/registry";

type AppMode = "local" | "radio";

interface AppContainer {
  mode: AppMode;
  localStore: ProjectStore;
  localSessions: SessionDriver;
  localTranscript: TranscriptSource;
}

const KEY = "__ct_app_v2" as const;
const g = globalThis as unknown as Record<string, AppContainer | undefined>;

function init(): AppContainer {
  const cached = g[KEY];
  if (cached) return cached;

  const mode: AppMode = process.env.STORE === "radio" ? "radio" : "local";
  const container: AppContainer = {
    mode,
    localStore: new LocalProjectStore(),
    localSessions: new LocalSessionDriver(),
    localTranscript: new LocalTranscriptSource(),
  };
  g[KEY] = container;
  return container;
}

/**
 * In `radio` mode we resolve the adapter on every call. The Radio
 * connection comes from the in-memory registry — if no Radio is
 * connected, we fall back to the Local adapter so the UI still
 * functions (a paired-but-disconnected Radio still lets us read
 * the local files in dev).
 */
function radioOrLocalStore(): ProjectStore {
  const conn = radioRegistry.current();
  if (conn) return new RadioProjectStore(conn);
  return init().localStore;
}

function radioOrLocalSessions(): SessionDriver {
  const conn = radioRegistry.current();
  if (conn) return new RadioSessionDriver(conn);
  return init().localSessions;
}

function radioOrLocalTranscript(): TranscriptSource {
  const conn = radioRegistry.current();
  if (conn) return new RadioTranscriptSource(conn);
  return init().localTranscript;
}

export const getStore = (): ProjectStore => {
  const c = init();
  return c.mode === "radio" ? radioOrLocalStore() : c.localStore;
};

export const getSessionDriver = (): SessionDriver => {
  const c = init();
  return c.mode === "radio" ? radioOrLocalSessions() : c.localSessions;
};

export const getTranscriptSource = (): TranscriptSource => {
  const c = init();
  return c.mode === "radio" ? radioOrLocalTranscript() : c.localTranscript;
};

export const getAppMode = (): AppMode => init().mode;
