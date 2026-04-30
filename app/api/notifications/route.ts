/**
 * GET /api/notifications?since=<epoch-ms-or-iso>
 *
 * Global polling endpoint for the in-app notification system (T113). Iterates
 * every registered project, runs the per-project diff/persist via
 * `getNotificationsSince`, merges the resulting buffers, and returns them
 * sorted newest-first.
 *
 * Read-only; no body parsing. CSRF middleware (proxy.ts) ignores GETs.
 *
 * `since` validation: epoch-ms digits or ISO 8601 — anything else maps to 0
 * (return everything in the buffer). Never passed to a regex builder, file
 * path, or shell argument.
 */

import { NextRequest, NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";
import { getNotificationsSince } from "@/lib/notification-store";

const EPOCH_RE = /^\d+$/;

function parseSince(raw: string | null): number {
  if (!raw) return 0;
  if (EPOCH_RE.test(raw)) {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  // Try ISO 8601
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

export async function GET(req: NextRequest | Request) {
  const url = new URL(req.url);
  const sinceMs = parseSince(url.searchParams.get("since"));

  try {
    const projects = await listProjects();
    const lists = await Promise.all(
      projects.map((p, idx) => getNotificationsSince(p.path, idx, p.name, sinceMs)),
    );
    const merged = lists.flat();
    merged.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return NextResponse.json({ data: { notifications: merged } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
