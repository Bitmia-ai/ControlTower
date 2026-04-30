/**
 * Radio WS connection wrapper.
 *
 * One instance per connected Radio. Owns the underlying WebSocket,
 * tracks pending requests by correlation id, exposes a typed `call`
 * method that returns a promise resolving to the response payload (or
 * rejecting with the wire error).
 *
 * Phase 3 minimum: request/response. Subscriptions and event push
 * (project.update, notifications) land in the next pass.
 */

import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

import type {
  ErrorEnvelope,
  Frame,
  Hello,
  Request,
  Response,
} from "./protocol";

const REQUEST_TIMEOUT_MS = 30_000;

export class RadioWireError extends Error {
  constructor(public envelope: ErrorEnvelope) {
    super(`${envelope.code}: ${envelope.message}`);
    this.name = "RadioWireError";
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class RadioConnection {
  readonly radioId: string;
  readonly label: string;
  readonly capabilities: ReadonlySet<string>;
  readonly connectionId: string;
  readonly connectedAt: Date;

  private readonly ws: WebSocket;
  private readonly pending = new Map<string, Pending>();
  private closed = false;
  private readonly listeners = new Set<(frame: Frame) => void>();

  constructor(opts: {
    ws: WebSocket;
    hello: Hello;
    capabilities: string[];
  }) {
    this.ws = opts.ws;
    this.radioId = opts.hello.radio_id;
    this.label = opts.hello.label;
    this.capabilities = new Set(opts.capabilities);
    this.connectionId = randomUUID();
    this.connectedAt = new Date();

    this.ws.on("message", (raw) => this.handleFrame(raw.toString()));
    this.ws.on("close", () => this.handleClose());
    this.ws.on("error", () => this.handleClose());
  }

  /** Send a request and resolve with `response.result` or reject. */
  async call<T = unknown>(
    op: string,
    payload: unknown,
    options: { idempotencyKey?: string; timeoutMs?: number } = {}
  ): Promise<T> {
    if (this.closed) throw new Error("radio connection is closed");
    const id = randomUUID();
    const frame: Request = {
      type: "request",
      id,
      op,
      idempotency_key: options.idempotencyKey,
      payload,
    };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`radio call ${op} timed out`));
      }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      this.ws.send(JSON.stringify(frame), (err) => {
        if (err) {
          this.completePending(id, err);
        }
      });
    });
  }

  /** Subscribe to inbound events / notifications. Returns unsubscribe. */
  onFrame(listener: (frame: Frame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isClosed(): boolean {
    return this.closed;
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      try {
        this.ws.close();
      } catch {
        // best effort
      }
      for (const id of [...this.pending.keys()]) {
        this.completePending(id, new Error("radio connection closed"));
      }
    }
  }

  private handleFrame(text: string): void {
    let frame: Frame;
    try {
      frame = JSON.parse(text) as Frame;
    } catch {
      return;
    }
    if (frame.type === "response") {
      this.handleResponse(frame);
    }
    // Notify listeners (events, notifications, etc.)
    for (const listener of this.listeners) listener(frame);
  }

  private handleResponse(resp: Response): void {
    const pending = this.pending.get(resp.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(resp.id);
    if (resp.ok) {
      pending.resolve(resp.result);
    } else {
      const env: ErrorEnvelope = resp.error ?? {
        code: "radio.internal",
        category: "server",
        message: "missing error envelope",
      };
      pending.reject(new RadioWireError(env));
    }
  }

  private handleClose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const id of [...this.pending.keys()]) {
      this.completePending(id, new Error("radio connection closed"));
    }
  }

  private completePending(id: string, err: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.reject(err);
  }
}
