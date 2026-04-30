/**
 * Custom Node server that hosts both Next.js (everything under /api,
 * /, etc.) and the Radio WS endpoint at /api/radio/ws. Run via:
 *
 *   npm run build && npm start
 *
 * Replaces `next start` so we can attach a WebSocket upgrade handler
 * to the same HTTP server. The Next.js request handler is delegated
 * to as before for non-upgrade traffic.
 */

import { createServer } from "node:http";
import next from "next";

import { attach as attachRadio } from "./lib/radio/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "3200");

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[ct] request handler error", err);
      try {
        res.statusCode = 500;
        res.end("internal error");
      } catch {
        /* best effort */
      }
    });
  });

  attachRadio(server);

  server.listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`[ct] listening on http://${hostname}:${port}`);
    // eslint-disable-next-line no-console
    console.log(`[ct] radio ws endpoint: ws://${hostname}:${port}/api/radio/ws`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[ct] fatal", err);
  process.exit(1);
});
