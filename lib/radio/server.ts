/**
 * WS server-side handler. Accepts an inbound Radio connection on
 * `/api/radio/ws`, validates the Hello frame, sends Welcome, and
 * registers the connection in the registry.
 *
 * v0.1 auth model (matches Radio's PROTOCOL.md §3): single-user, no
 * real auth yet. If `RADIO_TOKEN` env is set, the Hello frame must
 * carry that exact token; otherwise tokens are accepted unchecked.
 *
 * Pairing UX (single-user dev): no DB, no per-Radio tokens — just one
 * shared optional secret. Multi-user pairing (per-Radio tokens stored
 * in CT's DB) is a Phase 4 task.
 */

import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

import { RadioConnection } from "./client";
import * as registry from "./registry";
import {
  CT_CAPABILITIES,
  type Frame,
  type Hello,
  PROTOCOL_VERSION,
  type Welcome,
} from "./protocol";

export const WS_PATH = "/api/radio/ws";

const HELLO_TIMEOUT_MS = 5_000;

/**
 * Attach a WS upgrade handler to the given HTTP server. Hands off
 * upgrade requests on `/api/radio/ws` to the WebSocketServer; other
 * paths get a 404-style socket destroy.
 */
export function attach(httpServer: import("node:http").Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith(WS_PATH)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket as Socket, head, (ws) => {
      handleConnection(ws, req).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[radio] handshake failed", err);
        try {
          ws.close();
        } catch {
          /* best effort */
        }
      });
    });
  });
}

async function handleConnection(
  ws: WebSocket,
  _req: IncomingMessage
): Promise<void> {
  // Wait for Hello (with timeout). Anything else closes the connection.
  const hello = await awaitHello(ws);

  // Check shared token if env demands one.
  const requiredToken = process.env.RADIO_TOKEN;
  if (requiredToken && hello.token !== requiredToken) {
    sendWelcome(ws, {
      type: "welcome",
      ok: false,
      error: {
        code: "radio.unauthorized",
        category: "auth",
        message: "token rejected",
      },
    });
    ws.close();
    return;
  }

  if (hello.protocol_version !== PROTOCOL_VERSION) {
    sendWelcome(ws, {
      type: "welcome",
      ok: false,
      error: {
        code: "radio.protocol_mismatch",
        category: "auth",
        message: `expected protocol_version ${PROTOCOL_VERSION}, got ${hello.protocol_version}`,
      },
    });
    ws.close();
    return;
  }

  // Compute capability intersection.
  const ours = new Set(CT_CAPABILITIES);
  const intersection = hello.capabilities.filter((c) => ours.has(c as typeof CT_CAPABILITIES[number]));

  // Build the connection wrapper FIRST so we can return its
  // connection_id in the Welcome.
  const conn = new RadioConnection({
    ws,
    hello,
    capabilities: intersection,
  });

  const welcome: Welcome = {
    type: "welcome",
    ok: true,
    connection_id: conn.connectionId,
    server_time: new Date().toISOString(),
    capabilities: intersection,
    reconnect_required: false,
  };
  sendWelcome(ws, welcome);

  registry.register(conn);
  ws.on("close", () => {
    registry.unregister(conn.radioId);
    conn.close();
  });

  // eslint-disable-next-line no-console
  console.log(
    `[radio] connected radio_id=${conn.radioId} label=${conn.label} caps=[${[...conn.capabilities].join(",")}]`
  );
}

function awaitHello(ws: WebSocket): Promise<Hello> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("hello timeout"));
    }, HELLO_TIMEOUT_MS);

    const onMessage = (raw: Buffer): void => {
      let frame: Frame;
      try {
        frame = JSON.parse(raw.toString()) as Frame;
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      if (frame.type !== "hello") {
        cleanup();
        reject(new Error(`first frame must be hello, got ${frame.type}`));
        return;
      }
      cleanup();
      resolve(frame);
    };

    const onError = (e: Error): void => {
      cleanup();
      reject(e);
    };

    function cleanup(): void {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
    }

    ws.on("message", onMessage);
    ws.on("error", onError);
  });
}

function sendWelcome(ws: WebSocket, w: Welcome): void {
  try {
    ws.send(JSON.stringify(w));
  } catch {
    /* best effort */
  }
}
