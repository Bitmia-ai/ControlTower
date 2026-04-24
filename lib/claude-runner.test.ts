// @vitest-environment node
/**
 * Tests for claude-runner.ts
 * Mocks child_process.spawn for runClaudeCommand and spawnClaudeSession.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these are available when vi.mock factories run.
// ---------------------------------------------------------------------------

const { mockSpawn, mockMkdirSync, mockOpenSync, mockCloseSync } = vi.hoisted(() => ({
  mockSpawn: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockOpenSync: vi.fn(() => 99),
  mockCloseSync: vi.fn(),
}));

vi.mock(import("child_process"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, spawn: mockSpawn };
});

vi.mock(import("fs"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mkdirSync: mockMkdirSync,
    openSync: mockOpenSync,
    closeSync: mockCloseSync,
  };
});

// Import after mocks are set up.
import { parseStreamEvent, runClaudeCommand, spawnClaudeSession } from "./claude-runner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake child process for spawn mock. */
function makeFakeProc(opts: {
  stdout?: string[];
  exitCode?: number;
  spawnError?: Error;
}) {
  const proc = new EventEmitter() as any;
  proc.pid = 12345;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.unref = vi.fn();

  // Schedule stdout data + close in next microtask so listeners can attach.
  Promise.resolve().then(() => {
    if (opts.spawnError) {
      proc.emit("error", opts.spawnError);
      return;
    }
    for (const chunk of opts.stdout ?? []) {
      proc.stdout.emit("data", Buffer.from(chunk));
    }
    proc.emit("close", opts.exitCode ?? 0);
  });

  return proc;
}

// ---------------------------------------------------------------------------
// parseStreamEvent
// ---------------------------------------------------------------------------

describe("parseStreamEvent", () => {
  it("parses a system event", () => {
    const line = JSON.stringify({ type: "system", content: "init" });
    const event = parseStreamEvent(line);
    expect(event.type).toBe("system");
    expect(event.content).toBe("init");
  });

  it("parses an assistant event with subtype", () => {
    const line = JSON.stringify({ type: "assistant", subtype: "text", content: "hello" });
    const event = parseStreamEvent(line);
    expect(event.type).toBe("assistant");
    expect(event.subtype).toBe("text");
    expect(event.content).toBe("hello");
  });

  it("parses a result event with usage and cost", () => {
    const raw = {
      type: "result",
      usage: { input_tokens: 10, output_tokens: 20 },
      cost: 0.001,
    };
    const event = parseStreamEvent(JSON.stringify(raw));
    expect(event.type).toBe("result");
    expect(event.usage?.input_tokens).toBe(10);
    expect(event.cost).toBe(0.001);
  });

  it("parses a tool_use assistant event", () => {
    const raw = {
      type: "assistant",
      subtype: "tool_use",
      tool_name: "bash",
      tool_input: { command: "ls" },
    };
    const event = parseStreamEvent(JSON.stringify(raw));
    expect(event.subtype).toBe("tool_use");
    expect(event.tool_name).toBe("bash");
    expect(event.tool_input).toEqual({ command: "ls" });
  });

  it("throws on empty line", () => {
    expect(() => parseStreamEvent("")).toThrow();
    expect(() => parseStreamEvent("   ")).toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStreamEvent("{not json}")).toThrow(SyntaxError);
  });

  it("throws when type field is missing", () => {
    expect(() => parseStreamEvent(JSON.stringify({ content: "oops" }))).toThrow(
      /type/
    );
  });
});

// ---------------------------------------------------------------------------
// runClaudeCommand
// ---------------------------------------------------------------------------

describe("runClaudeCommand", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  it("returns parsed events from stdout", async () => {
    const event1 = JSON.stringify({ type: "system", content: "ready" });
    const event2 = JSON.stringify({ type: "assistant", subtype: "text", content: "hi" });

    mockSpawn.mockReturnValue(
      makeFakeProc({ stdout: [`${event1}\n${event2}\n`] })
    );

    const events = await runClaudeCommand("/some/project", "say hi");
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("system");
    expect(events[1].type).toBe("assistant");
  });

  it("passes correct args to spawn (never shell interpolation)", async () => {
    mockSpawn.mockReturnValue(makeFakeProc({ stdout: [] }));

    await runClaudeCommand("/proj", "do something", "opus");

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [cmd, args, opts] = mockSpawn.mock.calls[0];
    expect(cmd).toBe("claude");
    expect(args).toContain("--print");
    expect(args).toContain("stream-json");
    expect(args).toContain("opus");
    expect(args).toContain("do something");
    // Must be an array (no shell interpolation)
    expect(Array.isArray(args)).toBe(true);
    expect(opts?.cwd).toBe("/proj");
  });

  it("uses default model sonnet when model not specified", async () => {
    mockSpawn.mockReturnValue(makeFakeProc({ stdout: [] }));

    await runClaudeCommand("/proj", "hello");

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("sonnet");
  });

  it("rejects when exit code is non-zero and no events collected", async () => {
    mockSpawn.mockReturnValue(makeFakeProc({ stdout: [], exitCode: 1 }));

    await expect(runClaudeCommand("/proj", "fail")).rejects.toThrow(/code 1/);
  });

  it("resolves even on non-zero exit if events were collected", async () => {
    const event = JSON.stringify({ type: "result", cost: 0 });
    mockSpawn.mockReturnValue(
      makeFakeProc({ stdout: [`${event}\n`], exitCode: 1 })
    );

    const events = await runClaudeCommand("/proj", "partial");
    expect(events).toHaveLength(1);
  });

  it("rejects on spawn error", async () => {
    mockSpawn.mockReturnValue(
      makeFakeProc({ spawnError: new Error("ENOENT: claude not found") })
    );

    await expect(runClaudeCommand("/proj", "hi")).rejects.toThrow("ENOENT");
  });

  it("skips unparseable lines without throwing", async () => {
    const good = JSON.stringify({ type: "system" });
    mockSpawn.mockReturnValue(
      makeFakeProc({ stdout: [`garbage line\n${good}\n`] })
    );

    const events = await runClaudeCommand("/proj", "mixed");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("system");
  });
});

// ---------------------------------------------------------------------------
// spawnClaudeSession
// ---------------------------------------------------------------------------

describe("spawnClaudeSession", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
    mockMkdirSync.mockReset();
    mockOpenSync.mockReset().mockReturnValue(99);
    mockCloseSync.mockReset();
  });

  it("returns pid and logFile", () => {
    const fakeProc = makeFakeProc({});
    fakeProc.pid = 99999;
    mockSpawn.mockReturnValue(fakeProc);

    const result = spawnClaudeSession("/myproject", "cto", "build the thing");
    expect(result.pid).toBe(99999);
    expect(result.logFile).toMatch(/session-cto\.jsonl$/);
    expect(result.logFile).toContain(".redeye");
  });

  it("calls unref() for detachment", () => {
    const fakeProc = makeFakeProc({});
    mockSpawn.mockReturnValue(fakeProc);

    spawnClaudeSession("/myproject", "tester", "test everything");
    expect(fakeProc.unref).toHaveBeenCalled();
  });

  it("passes detached: true to spawn", () => {
    mockSpawn.mockReturnValue(makeFakeProc({}));

    spawnClaudeSession("/myproject", "documenter", "document it");

    const [, , opts] = mockSpawn.mock.calls[0];
    expect((opts as any).detached).toBe(true);
  });

  it("passes correct prompt and role in args", () => {
    mockSpawn.mockReturnValue(makeFakeProc({}));

    spawnClaudeSession("/myproject", "cto", "my special prompt", "haiku");

    const [cmd, args] = mockSpawn.mock.calls[0];
    expect(cmd).toBe("claude");
    expect(args).toContain("my special prompt");
    expect(args).toContain("haiku");
  });

  it("log file path includes role name", () => {
    mockSpawn.mockReturnValue(makeFakeProc({}));

    const { logFile } = spawnClaudeSession("/proj", "cto", "go");
    expect(logFile).toContain("session-cto.jsonl");
  });
});
