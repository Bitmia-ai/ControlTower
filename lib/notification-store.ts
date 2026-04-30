/**
 * lib/notification-store.ts
 *
 * Server-side notification store for the in-app notification system (T113).
 *
 * Owns:
 *   - A module-level `Map<projectPath, NotificationState>` that holds the
 *     last-seen `state.json` snapshot and the in-memory ring buffer of events.
 *   - Diff logic for detecting three event types: task-complete, task-error,
 *     needs-input.
 *   - Persistence to `.redeye/notifications.json` via `atomicWriteJson`.
 *   - Hydration from disk on first GET per project per process restart.
 *
 * The store is intentionally stateless across restarts: `notifications.json`
 * is the durable record. Snapshot diff is best-effort; the worst case after a
 * restart is one missed event because the prev-snapshot is rebuilt from null.
 */

import fs from "fs/promises";
import { atomicWriteJson } from "./atomic-write";
import { readState, safeRedeyePath } from "./redeye-files";
import type { NotificationItem, RedEyeState } from "./redeye-types";

export const RING_BUFFER_CAP = 50;
const NOTIFICATIONS_FILE = "notifications.json";

interface ProjectNotificationState {
  events: NotificationItem[];
  lastSnapshot: RedEyeState | null;
  hydrated: boolean;
}

const store = new Map<string, ProjectNotificationState>();

function getOrInit(projectPath: string): ProjectNotificationState {
  let s = store.get(projectPath);
  if (!s) {
    s = { events: [], lastSnapshot: null, hydrated: false };
    store.set(projectPath, s);
  }
  return s;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compare two state snapshots and emit any new notification events that
 * resulted from the transition. Returns an empty list when `prev` is null
 * (first observation), or when no relevant transitions occurred.
 */
export function detectEvents(
  prev: RedEyeState | null,
  next: RedEyeState,
  projectId: number,
  projectName: string,
): NotificationItem[] {
  if (prev === null) return [];

  const events: NotificationItem[] = [];
  const ts = new Date().toISOString();

  // task-complete: MERGE phase newly complete
  const wasMergeComplete = prev.phase === "MERGE" && prev.phase_status === "complete";
  const isMergeComplete = next.phase === "MERGE" && next.phase_status === "complete";
  if (isMergeComplete && !wasMergeComplete) {
    const id = next.task_id ?? "Task";
    events.push({
      id: newId(),
      type: "task-complete",
      projectId,
      projectName,
      message: `${id} complete — merged to main`,
      timestamp: ts,
      taskId: next.task_id ?? null,
    });
  }

  // task-error: entered STABILIZE
  if (next.phase === "STABILIZE" && prev.phase !== "STABILIZE") {
    events.push({
      id: newId(),
      type: "task-error",
      projectId,
      projectName,
      message: `Stabilizing — environment issue detected`,
      timestamp: ts,
      taskId: next.task_id ?? null,
    });
  }

  // needs-input: questions_awaiting_ceo incremented
  const prevQ = prev.health?.questions_awaiting_ceo ?? 0;
  const nextQ = next.health?.questions_awaiting_ceo ?? 0;
  if (nextQ > prevQ) {
    const delta = nextQ - prevQ;
    events.push({
      id: newId(),
      type: "needs-input",
      projectId,
      projectName,
      message: `${delta} new question${delta > 1 ? "s" : ""} awaiting CEO input`,
      timestamp: ts,
      taskId: next.task_id ?? null,
    });
  }

  return events;
}

/**
 * Append events to a project's ring buffer, trimming to RING_BUFFER_CAP, and
 * persist the whole buffer to disk. No-op when `events` is empty (avoids
 * spurious file writes on every poll).
 */
export async function appendEvents(
  projectPath: string,
  events: NotificationItem[],
): Promise<void> {
  if (events.length === 0) return;
  const s = getOrInit(projectPath);
  // Mark hydrated so a follow-up getNotificationsSince does not clobber the
  // in-memory buffer with the on-disk version (which may be stale or empty
  // in tests/first-run).
  s.hydrated = true;
  s.events = [...s.events, ...events];
  if (s.events.length > RING_BUFFER_CAP) {
    s.events = s.events.slice(s.events.length - RING_BUFFER_CAP);
  }
  await persistToFile(projectPath, s.events);
}

/**
 * Read `.redeye/notifications.json` and return the parsed array. Returns an
 * empty array on missing file or parse errors so callers can treat the
 * pre-hydrate state and a clean install identically.
 */
export async function hydrateFromFile(
  projectPath: string,
): Promise<NotificationItem[]> {
  const filePath = safeRedeyePath(projectPath, NOTIFICATIONS_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as NotificationItem[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    return [];
  }
}

export async function persistToFile(
  projectPath: string,
  items: NotificationItem[],
): Promise<void> {
  const filePath = safeRedeyePath(projectPath, NOTIFICATIONS_FILE);
  await atomicWriteJson(filePath, JSON.stringify(items));
}

/**
 * Top-level entry point used by the GET /api/notifications route.
 *
 *   1. On first call per project per process, hydrate the buffer from disk.
 *   2. Read state.json and diff against the previous snapshot.
 *   3. Append any new events; persist to disk.
 *   4. Return the buffer filtered to events with timestamp > sinceMs.
 *
 * `sinceMs = 0` returns the full buffer (used on initial drawer load).
 *
 * @param skipDiff — Test-only escape hatch that returns the buffer without
 *   reading state.json. Production callers should pass `false` or omit it.
 */
export async function getNotificationsSince(
  projectPath: string,
  projectId: number,
  projectName: string,
  sinceMs: number,
  skipDiff = false,
): Promise<NotificationItem[]> {
  const s = getOrInit(projectPath);

  if (!s.hydrated) {
    s.events = await hydrateFromFile(projectPath);
    s.hydrated = true;
  }

  if (!skipDiff) {
    const next = await readState(projectPath);
    if (next) {
      const newEvents = detectEvents(s.lastSnapshot, next, projectId, projectName);
      s.lastSnapshot = next;
      if (newEvents.length > 0) {
        await appendEvents(projectPath, newEvents);
      }
    }
  }

  return s.events.filter((e) => new Date(e.timestamp).getTime() > sinceMs);
}

/** Test-only — clears the module-level Map so tests don't leak state. */
export function __resetNotificationStateForTests(): void {
  store.clear();
}
