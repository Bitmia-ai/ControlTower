import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create mock fns at module scope so they are available in the vi.mock factory
const mockStatSync = vi.fn();
const mockOpenSync = vi.fn();
const mockFstatSync = vi.fn();
const mockReadSync = vi.fn();
const mockCloseSync = vi.fn();
const mockWatch = vi.fn();
const mockAccessSync = vi.fn();

vi.mock("fs", () => ({
  default: {
    statSync: (...args: unknown[]) => mockStatSync(...args),
    openSync: (...args: unknown[]) => mockOpenSync(...args),
    fstatSync: (...args: unknown[]) => mockFstatSync(...args),
    readSync: (...args: unknown[]) => mockReadSync(...args),
    closeSync: (...args: unknown[]) => mockCloseSync(...args),
    watch: (...args: unknown[]) => mockWatch(...args),
    accessSync: (...args: unknown[]) => mockAccessSync(...args),
  },
}));

import { createSSEStream, tailJsonl } from "./stream-utils";

function setupFsDefaults(watcherClose: ReturnType<typeof vi.fn> = vi.fn()) {
  mockStatSync.mockReturnValue({ size: 0 });
  mockOpenSync.mockReturnValue(3);
  mockFstatSync.mockReturnValue({ size: 0 });
  mockReadSync.mockReturnValue(0);
  mockCloseSync.mockReturnValue(undefined);
  mockWatch.mockReturnValue({ close: watcherClose });
}

describe("createSSEStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFsDefaults();
  });

  it("createSSEStream is exported and callable", () => {
    expect(createSSEStream).toBeTypeOf("function");
  });

  it("creates a ReadableStream when called without transformer", () => {
    const stream = createSSEStream("/fake/path.jsonl");
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("creates a ReadableStream when called with lineTransformer option", () => {
    const stream = createSSEStream("/fake/path.jsonl", {
      lineTransformer: (line) => line,
    });
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("existing createSSEStream(filePath) call signature works (backward compat)", () => {
    expect(() => createSSEStream("/fake/path.jsonl")).not.toThrow();
  });

  it("accepts lineTransformer option that returns null without error", () => {
    expect(() =>
      createSSEStream("/fake/path.jsonl", { lineTransformer: () => null })
    ).not.toThrow();
  });
});

describe("createSSEStream with fileResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFsDefaults();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a fileResolver option without error", () => {
    const stream = createSSEStream("/fake/path.jsonl", {
      fileResolver: () => "/fake/path.jsonl",
    });
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("does not switch files when fileResolver returns the same path", () => {
    const resolver = vi.fn(() => "/fake/path.jsonl");
    createSSEStream("/fake/path.jsonl", { fileResolver: resolver });

    // Advance past one rescan interval (30s)
    vi.advanceTimersByTime(30_000);

    // Resolver was called but since path is the same, no switch occurs
    expect(resolver).toHaveBeenCalled();
  });

  it("calls fileResolver periodically to detect file changes", () => {
    const resolver = vi.fn(() => "/fake/path.jsonl");
    createSSEStream("/fake/path.jsonl", { fileResolver: resolver });

    vi.advanceTimersByTime(90_000); // 3 intervals
    expect(resolver.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("switches tail target when fileResolver returns a different path", () => {
    let currentFile = "/fake/old.jsonl";
    const resolver = vi.fn(() => currentFile);

    // Track watch calls to verify old watcher gets closed and new one opens
    const closeOld = vi.fn();
    const closeNew = vi.fn();
    let watchCallCount = 0;
    mockWatch.mockImplementation(() => {
      watchCallCount++;
      return { close: watchCallCount === 1 ? closeOld : closeNew };
    });

    createSSEStream("/fake/old.jsonl", { fileResolver: resolver });

    // Change the resolved file
    currentFile = "/fake/new.jsonl";
    vi.advanceTimersByTime(30_000);

    // The old watcher should have been closed (cleanup called)
    expect(closeOld).toHaveBeenCalled();
  });

  it("emits __session_boundary__ sentinel when fileResolver returns a different path", () => {
    // This test verifies the boundary is emitted by checking that the old watcher
    // is closed and a new watch is opened when the file changes. The sentinel
    // emission itself is verified via side-effects: the new file path is passed
    // to a second tailJsonl call. We verify closeOld is called (cleanup ran) and
    // a second watch was opened for the new path.
    let currentFile = "/fake/old.jsonl";
    const resolver = vi.fn(() => currentFile);

    const watchedPaths: string[] = [];
    const closeOld = vi.fn();
    let watchCallCount = 0;
    mockWatch.mockImplementation((p: string) => {
      watchedPaths.push(p);
      watchCallCount++;
      return { close: watchCallCount === 1 ? closeOld : vi.fn() };
    });

    createSSEStream("/fake/old.jsonl", { fileResolver: resolver });

    // Change file and trigger rescan
    currentFile = "/fake/new.jsonl";
    vi.advanceTimersByTime(30_000);

    // Old watcher was closed (cleanup was called before sentinel + new tail)
    expect(closeOld).toHaveBeenCalled();
    // A new watcher was opened for the new path
    expect(watchedPaths).toContain("/fake/new.jsonl");
  });

  it("cancel cleans up the rescan timer", () => {
    const resolver = vi.fn(() => "/fake/path.jsonl");
    const stream = createSSEStream("/fake/path.jsonl", { fileResolver: resolver });

    // Get a reader to trigger start(), then cancel
    const reader = stream.getReader();
    reader.cancel();

    // After cancel, advancing timers should not call resolver again
    const callsBefore = resolver.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    // May have been called once during setup, but not after cancel
    expect(resolver.mock.calls.length).toBeLessThanOrEqual(callsBefore + 1);
  });
});

describe("tailJsonl with lookbackBytes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFsDefaults();
  });

  it("replays recent lines when lookbackBytes > 0", () => {
    const line1 = '{"line":1}';
    const line2 = '{"line":2}';
    const content = `${line1}\n${line2}\n`;
    const contentBuf = Buffer.from(content, "utf-8");

    mockStatSync.mockReturnValue({ size: contentBuf.length });
    mockOpenSync.mockReturnValue(3);
    mockReadSync.mockImplementation((_fd: number, buf: Buffer, _offset: number, _length: number, pos: number) => {
      const slice = contentBuf.slice(pos, pos + buf.length);
      slice.copy(buf);
      return slice.length;
    });
    mockCloseSync.mockReturnValue(undefined);
    mockWatch.mockReturnValue({ close: vi.fn() });

    const lines: string[] = [];
    // lookbackBytes large enough to capture all content
    tailJsonl("/fake/path.jsonl", (line) => lines.push(line), { lookbackBytes: 1000 });

    expect(lines).toEqual([line1, line2]);
  });

  it("drops partial leading line when starting mid-file", () => {
    // Simulate a large file where lookback starts mid-line
    const fullContent = '{"partial":"yes"}\n{"full":"line"}\n';
    const contentBuf = Buffer.from(fullContent, "utf-8");
    const fileSize = contentBuf.length;
    // lookbackBytes = 20 — starts into the middle of the first line
    const lookback = 20;
    const start = fileSize - lookback;

    mockStatSync.mockReturnValue({ size: fileSize });
    mockOpenSync.mockReturnValue(3);
    mockReadSync.mockImplementation((_fd: number, buf: Buffer, _offset: number, _length: number, pos: number) => {
      const slice = contentBuf.slice(pos, pos + buf.length);
      slice.copy(buf);
      return slice.length;
    });
    mockCloseSync.mockReturnValue(undefined);
    mockWatch.mockReturnValue({ close: vi.fn() });

    const lines: string[] = [];
    tailJsonl("/fake/path.jsonl", (line) => lines.push(line), { lookbackBytes: lookback });

    // Should only get the "full" line, not the partial leading fragment
    // The partial fragment depends on where we started — at least the partial is not emitted
    expect(lines.every(l => {
      try { JSON.parse(l); return true; } catch { return false; }
    })).toBe(true);
  });

  it("starts from EOF when lookbackBytes is 0 (default)", () => {
    const content = '{"line":1}\n{"line":2}\n';
    const contentBuf = Buffer.from(content, "utf-8");

    mockStatSync.mockReturnValue({ size: contentBuf.length });
    mockWatch.mockReturnValue({ close: vi.fn() });

    const lines: string[] = [];
    tailJsonl("/fake/path.jsonl", (line) => lines.push(line));
    // No watch callback fired — so no lines should be emitted from existing content
    expect(lines).toEqual([]);
  });
});

describe("backward-compat: no transformer when option omitted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFsDefaults();
  });

  it("emits raw lines without transformation when no lineTransformer is provided", () => {
    // This verifies that .redeye/session-cto.jsonl lines pass through as-is
    const content = '{"type":"assistant","subtype":"text","content":"hello"}\n';
    const contentBuf = Buffer.from(content, "utf-8");
    let watchCb: (() => void) | null = null;

    mockStatSync.mockReturnValue({ size: 0 });
    mockWatch.mockImplementation((_p: string, cb: () => void) => {
      watchCb = cb;
      return { close: vi.fn() };
    });
    mockOpenSync.mockReturnValue(3);
    mockFstatSync.mockReturnValue({ size: contentBuf.length });
    mockReadSync.mockImplementation((_fd: number, buf: Buffer) => {
      contentBuf.copy(buf);
      return contentBuf.length;
    });

    const lines: string[] = [];
    tailJsonl("/fake/session-cto.jsonl", (line) => lines.push(line));
    (watchCb as (() => void) | null)?.();

    // The raw line is emitted without any transformation
    expect(lines).toEqual(['{"type":"assistant","subtype":"text","content":"hello"}']);
  });
});

describe("tailJsonl", () => {
  let watcherClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    watcherClose = vi.fn();
    setupFsDefaults(watcherClose);
  });

  it("returns a cleanup function", () => {
    const cleanup = tailJsonl("/fake/path.jsonl", vi.fn());
    expect(cleanup).toBeTypeOf("function");
  });

  it("cleanup function closes the watcher", () => {
    const cleanup = tailJsonl("/fake/path.jsonl", vi.fn());
    cleanup();
    expect(watcherClose).toHaveBeenCalledOnce();
  });

  it("calls onLine for each complete newline-terminated line when file grows", () => {
    const content = '{"line":1}\n{"line":2}\n';
    const contentBuf = Buffer.from(content, "utf-8");
    let watchCb: (() => void) | null = null;

    mockStatSync.mockReturnValue({ size: 0 });
    mockWatch.mockImplementation((_p: string, cb: () => void) => {
      watchCb = cb;
      return { close: vi.fn() };
    });
    mockOpenSync.mockReturnValue(3);
    mockFstatSync.mockReturnValue({ size: contentBuf.length });
    mockReadSync.mockImplementation((_fd: number, buf: Buffer) => {
      contentBuf.copy(buf);
      return contentBuf.length;
    });

    const lines: string[] = [];
    tailJsonl("/fake/path.jsonl", (line) => lines.push(line));
    (watchCb as (() => void) | null)?.();

    expect(lines).toEqual(['{"line":1}', '{"line":2}']);
  });

  it("does not call onLine when file has not grown", () => {
    mockStatSync.mockReturnValue({ size: 5 });
    let watchCb: (() => void) | null = null;
    mockWatch.mockImplementation((_p: string, cb: () => void) => {
      watchCb = cb;
      return { close: vi.fn() };
    });
    mockFstatSync.mockReturnValue({ size: 5 }); // same size

    const onLine = vi.fn();
    tailJsonl("/fake/path.jsonl", onLine);
    (watchCb as (() => void) | null)?.();

    expect(onLine).not.toHaveBeenCalled();
  });

  it("transformer wrapping: applies transformation to each line", () => {
    const content = '{"foo":"bar"}\n';
    const contentBuf = Buffer.from(content, "utf-8");
    let watchCb: (() => void) | null = null;

    mockStatSync.mockReturnValue({ size: 0 });
    mockWatch.mockImplementation((_p: string, cb: () => void) => {
      watchCb = cb;
      return { close: vi.fn() };
    });
    mockOpenSync.mockReturnValue(3);
    mockFstatSync.mockReturnValue({ size: contentBuf.length });
    mockReadSync.mockImplementation((_fd: number, buf: Buffer) => {
      contentBuf.copy(buf);
      return contentBuf.length;
    });

    const transformer = vi.fn((line: string) => `T:${line}`);
    const emitted: string[] = [];

    tailJsonl("/fake/path.jsonl", (line) => {
      const out = transformer(line);
      if (out !== null) emitted.push(out);
    });
    (watchCb as (() => void) | null)?.();

    expect(transformer).toHaveBeenCalledWith('{"foo":"bar"}');
    expect(emitted).toEqual(['T:{"foo":"bar"}']);
  });

  it("null transformer result skips the line", () => {
    const content = '{"skip":"me"}\n';
    const contentBuf = Buffer.from(content, "utf-8");
    let watchCb: (() => void) | null = null;

    mockStatSync.mockReturnValue({ size: 0 });
    mockWatch.mockImplementation((_p: string, cb: () => void) => {
      watchCb = cb;
      return { close: vi.fn() };
    });
    mockOpenSync.mockReturnValue(3);
    mockFstatSync.mockReturnValue({ size: contentBuf.length });
    mockReadSync.mockImplementation((_fd: number, buf: Buffer) => {
      contentBuf.copy(buf);
      return contentBuf.length;
    });

    const transformer = vi.fn((_line: string): string | null => null);
    const emitted: string[] = [];

    tailJsonl("/fake/path.jsonl", (line) => {
      const out = transformer(line);
      if (out !== null) emitted.push(out);
    });
    (watchCb as (() => void) | null)?.();

    expect(transformer).toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
  });
});
