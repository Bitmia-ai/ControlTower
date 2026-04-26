import fs from "fs";
import { ReadableStream } from "stream/web";

/** Options for {@link tailJsonl}. */
export interface TailJsonlOptions {
  /**
   * If set, instead of starting at the current end of file, start
   * `lookbackBytes` before the end and replay those bytes' worth of lines
   * immediately. This lets a mid-session consumer see the recent transcript
   * (T013 reopened — bug #3). Partial leading lines are dropped so we never
   * emit a truncated JSON fragment.
   */
  lookbackBytes?: number;
}

/** Tail a JSONL file, calling onLine for each new line. Returns a cleanup function. */
export function tailJsonl(
  filePath: string,
  onLine: (line: string) => void,
  options: TailJsonlOptions = {}
): () => void {
  const { lookbackBytes = 0 } = options;

  let position = 0;
  let buffer = "";

  if (lookbackBytes > 0) {
    let fd: number | undefined;
    try {
      const stats = fs.statSync(filePath);
      const size = stats.size;
      const start = Math.max(0, size - lookbackBytes);
      fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(size - start);
      if (buf.length > 0) {
        fs.readSync(fd, buf, 0, buf.length, start);
      }
      let text = buf.toString("utf-8");
      // If we started mid-line, drop the partial leading fragment so we
      // never emit broken JSON.
      if (start > 0) {
        const nl = text.indexOf("\n");
        if (nl >= 0) {
          text = text.slice(nl + 1);
        } else {
          text = "";
        }
      }
      const lines = text.split("\n");
      const trailing = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
      buffer = trailing;
      position = size;
    } catch {
      // File doesn't exist yet — start from 0.
      position = 0;
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch { /* ignore */ }
      }
    }
  } else {
    try {
      const stats = fs.statSync(filePath);
      position = stats.size;
    } catch {
      // File doesn't exist yet — start from 0.
    }
  }

  const readNewLines = () => {
    let fd: number | null = null;
    try {
      fd = fs.openSync(filePath, "r");
      const stats = fs.fstatSync(fd);

      if (stats.size > position) {
        const buf = Buffer.alloc(stats.size - position);
        fs.readSync(fd, buf, 0, buf.length, position);
        position = stats.size;

        buffer += buf.toString("utf-8");
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            onLine(line);
          }
        }
      }
    } catch {
      // File may not exist yet, or read raced with rotation.
    } finally {
      if (fd !== null) {
        try { fs.closeSync(fd); } catch {}
      }
    }
  };

  let watcher: fs.FSWatcher | null = null;
  try {
    watcher = fs.watch(filePath, () => readNewLines());
  } catch {
    const pollInterval = setInterval(() => {
      // Wrap the watch attempt — fs.watch can throw async (race against
      // file deletion) and an unhandled timer-callback exception terminates
      // the Node process.
      try {
        fs.accessSync(filePath);
        try {
          watcher = fs.watch(filePath, () => readNewLines());
          clearInterval(pollInterval);
        } catch {
          // Watch failed (race) — keep polling.
        }
      } catch {
        // Still waiting for file.
      }
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      watcher?.close();
    };
  }

  return () => {
    watcher?.close();
  };
}

export interface SSEStreamOptions {
  /**
   * Optional transformer applied to each JSONL line before SSE emission.
   * Return a string or array of strings to emit, or null to skip the line
   * entirely. An array causes one SSE `data:` event per element.
   * When not provided, lines are emitted as-is.
   */
  lineTransformer?: (line: string) => string | string[] | null;

  /**
   * Optional resolver called every 30s to detect when the target transcript
   * file has changed (e.g. a new session started). When the returned path
   * differs from the current one, the old tail is closed and a new tail is
   * started on the new file. Return null to keep the current file.
   */
  fileResolver?: () => string | null;

  /**
   * If set, replay the last `lookbackBytes` of the tailed file on connection
   * so mid-session consumers see recent transcript (T013 reopened — bug #3).
   */
  lookbackBytes?: number;
}

/** Create a ReadableStream that tails a JSONL file and formats as SSE events. */
export function createSSEStream(
  filePath: string,
  options?: SSEStreamOptions
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const { lineTransformer, fileResolver, lookbackBytes } = options ?? {};

  let cleanupFn: (() => void) | undefined;
  let keepaliveTimer: ReturnType<typeof setInterval> | undefined;
  let rescanTimer: ReturnType<typeof setInterval> | undefined;
  let currentFilePath = filePath;

  const emitLine = (controller: ReadableStreamDefaultController<Uint8Array>, line: string) => {
    try {
      const payload = lineTransformer ? lineTransformer(line) : line;
      if (payload === null) return; // transformer chose to skip this line
      const payloads = Array.isArray(payload) ? payload : [payload];
      for (const p of payloads) {
        controller.enqueue(encoder.encode(`data: ${p}\n\n`));
      }
    } catch {
      // Stream might be closed
    }
  };

  return new ReadableStream({
    start(controller) {
      cleanupFn = tailJsonl(
        currentFilePath,
        (line) => emitLine(controller, line),
        { lookbackBytes }
      );

      keepaliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepaliveTimer);
        }
      }, 30000);

      // Periodically re-resolve the transcript file to detect session changes.
      if (fileResolver) {
        rescanTimer = setInterval(() => {
          const newPath = fileResolver();
          if (newPath && newPath !== currentFilePath) {
            // Close old tail, start tailing the new file.
            cleanupFn?.();
            currentFilePath = newPath;
            // Emit a session boundary sentinel so the client can show a separator.
            try {
              const boundary = JSON.stringify({ type: "__session_boundary__", path: newPath });
              controller.enqueue(encoder.encode(`data: ${boundary}\n\n`));
            } catch {
              // Stream might be closing.
            }
            // New file tails from its current end — no lookback needed since
            // the user has been watching the prior session.
            cleanupFn = tailJsonl(currentFilePath, (line) => emitLine(controller, line));
          }
        }, 30_000);
      }
    },
    cancel() {
      cleanupFn?.();
      if (keepaliveTimer !== undefined) clearInterval(keepaliveTimer);
      if (rescanTimer !== undefined) clearInterval(rescanTimer);
    },
  });
}
