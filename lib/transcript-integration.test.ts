/**
 * T5: Integration smoke test — resolver + normalizer end-to-end
 *
 * Verifies that resolveTranscriptFile + normalizeTranscriptLine together
 * correctly handle fixture CLI transcript files.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";

// CLI fixture JSONL lines (real format from Claude CLI)
const FIXTURE_LINES = [
  JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text: "Starting analysis..." }],
      usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0 },
    },
    uuid: "uuid-1",
    sessionId: "session-abc",
    timestamp: "2026-04-24T10:00:00.000Z",
  }),
  JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "thinking", thinking: "I should check the files first" }],
      usage: { input_tokens: 100, output_tokens: 10 },
    },
    uuid: "uuid-2",
    sessionId: "session-abc",
  }),
  JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", name: "Bash", input: { command: "ls -la" } }],
    },
    uuid: "uuid-3",
    sessionId: "session-abc",
  }),
  JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [{ type: "tool_result", content: "file1.ts\nfile2.ts\n" }],
    },
    uuid: "uuid-4",
    sessionId: "session-abc",
  }),
  JSON.stringify({
    type: "user",
    message: { role: "user", content: "Continue please" },
    uuid: "uuid-5",
    sessionId: "session-abc",
  }),
  // Skipped types
  JSON.stringify({ type: "permission-mode", mode: "auto" }),
  JSON.stringify({ type: "attachment", data: {} }),
  JSON.stringify({ type: "queue-operation", op: "push" }),
  JSON.stringify({ type: "last-prompt", prompt: "do stuff" }),
];

// Mock fs for the resolver
const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock("fs", () => ({
  default: {
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    openSync: vi.fn(),
    fstatSync: vi.fn(),
    readSync: vi.fn(),
    closeSync: vi.fn(),
    watch: vi.fn().mockReturnValue({ close: vi.fn() }),
    accessSync: vi.fn(),
  },
}));

import { resolveTranscriptFile } from "./transcript-file-resolver";
import { normalizeTranscriptLine } from "./transcript-normalizer";

const PROJECT_PATH = "/Users/test/my-project";
const REDEYE_FILE = path.join(PROJECT_PATH, ".redeye", "session-cto.jsonl");
const ENCODED = "-Users-test-my-project";
const CLI_DIR = path.join(os.homedir(), ".claude", "projects", ENCODED);

beforeEach(() => {
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
});

describe("T5: resolver + normalizer integration", () => {
  describe("file path resolution", () => {
    it("resolves to null when no files are available (no-file path)", () => {
      mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });
      mockReaddirSync.mockReturnValue([]);

      const result = resolveTranscriptFile(PROJECT_PATH);
      expect(result).toBeNull();
    });

    it("resolves to .redeye file when fresh", () => {
      const freshMtime = Date.now() - 10_000;
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: freshMtime };
        throw new Error("ENOENT");
      });

      const result = resolveTranscriptFile(PROJECT_PATH);
      expect(result).toBe(REDEYE_FILE);
    });

    it("resolves to CLI transcript file when .redeye is absent", () => {
      const fixtureFile = path.join(CLI_DIR, "fixture-session.jsonl");
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) throw new Error("ENOENT");
        if (p === fixtureFile) return { isDirectory: () => false, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["fixture-session.jsonl"]);

      const result = resolveTranscriptFile(PROJECT_PATH);
      expect(result).toBe(fixtureFile);
    });

    it("picks most recent among multiple CLI transcript files", () => {
      const older = path.join(CLI_DIR, "old-session.jsonl");
      const newer = path.join(CLI_DIR, "new-session.jsonl");
      const olderMtime = Date.now() - 60_000;
      const newerMtime = Date.now() - 5_000;

      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) throw new Error("ENOENT");
        if (p === older) return { isDirectory: () => false, mtimeMs: olderMtime };
        if (p === newer) return { isDirectory: () => false, mtimeMs: newerMtime };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["old-session.jsonl", "new-session.jsonl"]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(newer);
    });
  });

  describe("normalizer handles all fixture lines", () => {
    it("normalizes assistant text line", () => {
      const result = normalizeTranscriptLine(FIXTURE_LINES[0]);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "text",
        content: "Starting analysis...",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: undefined,
        },
      }]);
    });

    it("normalizes assistant thinking line", () => {
      const result = normalizeTranscriptLine(FIXTURE_LINES[1]);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "thinking",
        content: "I should check the files first",
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          cache_read_input_tokens: undefined,
          cache_creation_input_tokens: undefined,
        },
      }]);
    });

    it("normalizes assistant tool_use line", () => {
      const result = normalizeTranscriptLine(FIXTURE_LINES[2]);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "tool_use",
        tool_name: "Bash",
        tool_input: { command: "ls -la" },
        usage: undefined,
      }]);
    });

    it("normalizes user tool_result line", () => {
      const result = normalizeTranscriptLine(FIXTURE_LINES[3]);
      expect(result).toEqual([{
        type: "user",
        subtype: "tool_result",
        content: "file1.ts\nfile2.ts\n",
      }]);
    });

    it("normalizes user text string content", () => {
      const result = normalizeTranscriptLine(FIXTURE_LINES[4]);
      expect(result).toEqual([{
        type: "user",
        content: "Continue please",
      }]);
    });

    it("returns empty array for permission-mode (skipped)", () => {
      expect(normalizeTranscriptLine(FIXTURE_LINES[5])).toEqual([]);
    });

    it("returns empty array for attachment (skipped)", () => {
      expect(normalizeTranscriptLine(FIXTURE_LINES[6])).toEqual([]);
    });

    it("returns empty array for queue-operation (skipped)", () => {
      expect(normalizeTranscriptLine(FIXTURE_LINES[7])).toEqual([]);
    });

    it("returns empty array for last-prompt (skipped)", () => {
      expect(normalizeTranscriptLine(FIXTURE_LINES[8])).toEqual([]);
    });
  });

  describe("end-to-end: fixture JSONL → normalized SSE events", () => {
    it("normalizes all fixture lines — 5 emitted events from 5 data lines, 4 skipped", () => {
      const emitted = FIXTURE_LINES
        .flatMap((line) => normalizeTranscriptLine(line));

      expect(emitted).toHaveLength(5);
      expect(emitted.map((e) => e.type)).toEqual([
        "assistant",
        "assistant",
        "assistant",
        "user",
        "user",
      ]);
    });

    it("produces valid JSON-serializable events for SSE transport", () => {
      const emitted = FIXTURE_LINES
        .flatMap((line) => normalizeTranscriptLine(line));

      for (const event of emitted) {
        expect(() => JSON.stringify(event)).not.toThrow();
        const roundTripped = JSON.parse(JSON.stringify(event));
        expect(roundTripped.type).toBeDefined();
      }
    });

    it("resolver returns null → caller uses keepalive-only stream (contract test)", () => {
      mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });
      mockReaddirSync.mockReturnValue([]);

      const resolved = resolveTranscriptFile(PROJECT_PATH);
      // When null, the route returns keepalive-only — verify the null contract
      expect(resolved).toBeNull();
      // No further SSE line processing happens when resolved is null
    });
  });

  describe("m2: backward-compat — .redeye session file used directly (no normalizer)", () => {
    it("resolves to the redeye session file when it is fresh", () => {
      const freshMtime = Date.now() - 10_000;
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: freshMtime };
        throw new Error("ENOENT");
      });

      const result = resolveTranscriptFile(PROJECT_PATH);
      expect(result).toBe(REDEYE_FILE);
    });

    it("redeye session file path does NOT trigger the normalizer (backward compat)", () => {
      // The normalizer is only applied to CLI transcript files, not to the
      // .redeye/session-cto.jsonl file (which already emits ClaudeStreamEvent JSON).
      // Verify this by confirming the resolved file path is exactly REDEYE_FILE.
      const freshMtime = Date.now() - 5_000;
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: freshMtime };
        throw new Error("ENOENT");
      });

      const resolved = resolveTranscriptFile(PROJECT_PATH);
      expect(resolved).toBe(REDEYE_FILE);

      // The route uses isRedeyeSessionFile() to decide whether to apply the
      // normalizer. When resolved === REDEYE_FILE, useNormalizer is false.
      // A raw line from the redeye file should pass through the normalizer
      // returning empty (it's already ClaudeStreamEvent format, not CLI envelope).
      const redeyeLine = JSON.stringify({
        type: "assistant",
        subtype: "text",
        content: "Already a ClaudeStreamEvent",
      });
      // normalizeTranscriptLine treats this as a non-"assistant" CLI envelope because
      // "assistant" type with no `message.content` array → returns empty array.
      // This confirms the route must NOT apply the normalizer to redeye lines.
      const normalized = normalizeTranscriptLine(redeyeLine);
      expect(normalized).toEqual([]);
    });
  });
});
