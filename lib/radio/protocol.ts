/**
 * Wire types matching Radio's PROTOCOL.md §4 and §5.
 *
 * Kept minimal — we only model the subset CT speaks today. The
 * `payload` and `result` are typed as `unknown` because they're
 * op-specific; each adapter narrows.
 */

export const PROTOCOL_VERSION = "0.1";

export type Category = "auth" | "client" | "server" | "transient" | "cancelled";

export interface ErrorEnvelope {
  code: string;
  category: Category;
  message: string;
  detail?: unknown;
  retry_after_ms?: number;
}

export interface Hello {
  type: "hello";
  protocol_version: string;
  radio_id: string;
  label: string;
  token?: string;
  capabilities: string[];
}

export interface Welcome {
  type: "welcome";
  ok: boolean;
  connection_id?: string;
  server_time?: string;
  capabilities?: string[];
  reconnect_required?: boolean;
  error?: ErrorEnvelope;
}

export interface Request {
  type: "request";
  id: string;
  op: string;
  idempotency_key?: string;
  payload: unknown;
}

export interface Response {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: ErrorEnvelope;
}

export interface Event {
  type: "event";
  topic: string;
  payload: unknown;
}

export interface Cancel {
  type: "cancel";
  id: string;
}

export type Frame = Hello | Welcome | Request | Response | Event | Cancel;

export const CT_CAPABILITIES = [
  "subscriptions",
  "idempotency",
  "transcript-gap",
  "cancellation",
] as const;

/** Stable op-name constants. Must match Radio's protocol::ops module. */
export const OPS = {
  PROJECTS_LIST: "projects.list",
  PROJECTS_ADD: "projects.add",
  PROJECTS_REMOVE: "projects.remove",
  PROJECT_STATE: "project.state",
  SUBSCRIBE_PROJECT: "subscribe.project",
  UNSUBSCRIBE_PROJECT: "unsubscribe.project",
  SESSION_START: "session.start",
  SESSION_STOP: "session.stop",
  SESSION_FORCE_STOP: "session.force_stop",
  SESSION_STATUS: "session.status",
} as const;
