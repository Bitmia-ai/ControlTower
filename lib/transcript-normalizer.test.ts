import { describe, it, expect } from "vitest";
import { normalizeTranscriptLine } from "./transcript-normalizer";

describe("normalizeTranscriptLine", () => {
  describe("assistant text content", () => {
    it("maps text block to assistant/text event", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "text",
        content: "Hello world",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: undefined,
          cache_creation_input_tokens: undefined,
        },
        _key: expect.any(String),
      }]);
    });

    it("maps thinking block to assistant/thinking event", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "Let me think..." }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "thinking",
        content: "Let me think...",
        _key: expect.any(String),
      }]);
    });

    it("maps tool_use block to assistant/tool_use event", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              name: "Bash",
              input: { command: "ls -la" },
            },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "assistant",
        subtype: "tool_use",
        tool_name: "Bash",
        tool_input: { command: "ls -la" },
        _key: expect.any(String),
      }]);
    });

    it("returns empty array for assistant with no recognized content blocks", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "image", source: {} }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([]);
    });

    it("collects all recognized content blocks from multi-block envelope", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "First thought" },
            { type: "text", text: "Final answer" },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([
        { type: "assistant", subtype: "thinking", content: "First thought", _key: expect.any(String) },
        { type: "assistant", subtype: "text", content: "Final answer", _key: expect.any(String) },
      ]);
    });

    it("returns empty array for assistant with empty content array", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([]);
    });

    it("returns empty array for assistant with missing content", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([]);
    });
  });

  describe("user content", () => {
    it("maps user with tool_result to user/tool_result event", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              content: "command output here",
            },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "user",
        subtype: "tool_result",
        content: "command output here",
        _key: expect.any(String),
      }]);
    });

    it("maps user with string content to user event", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: "Hello from user",
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "user",
        content: "Hello from user",
        _key: expect.any(String),
      }]);
    });

    it("maps user with text block content to user event", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello from user text block" }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([{
        type: "user",
        content: "Hello from user text block",
        _key: expect.any(String),
      }]);
    });

    it("handles tool_result with array of text blocks as content", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_abc",
              content: [
                { type: "text", text: "line one" },
                { type: "text", text: "line two" },
              ],
            },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("user");
      expect(result[0].subtype).toBe("tool_result");
      // Content should be a string, not an array
      expect(typeof result[0].content).toBe("string");
      expect(result[0].content).toContain("line one");
      expect(result[0].content).toContain("line two");
    });

    it("handles tool_result with array of non-text blocks (e.g. tool_reference)", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_abc",
              content: [
                { type: "tool_reference", tool_name: "TaskCreate" },
                { type: "tool_reference", tool_name: "TaskUpdate" },
              ],
            },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("user");
      // Content should be a string (empty since no text blocks)
      expect(typeof result[0].content).toBe("string");
    });

    it("returns empty array for user with no content", () => {
      const line = JSON.stringify({
        type: "user",
        message: { role: "user" },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toEqual([]);
    });
  });

  describe("skipped types", () => {
    it("returns empty array for attachment type", () => {
      const line = JSON.stringify({ type: "attachment", data: {} });
      expect(normalizeTranscriptLine(line)).toEqual([]);
    });

    it("returns empty array for permission-mode type", () => {
      const line = JSON.stringify({ type: "permission-mode", mode: "auto" });
      expect(normalizeTranscriptLine(line)).toEqual([]);
    });

    it("returns empty array for queue-operation type", () => {
      const line = JSON.stringify({ type: "queue-operation", op: "push" });
      expect(normalizeTranscriptLine(line)).toEqual([]);
    });

    it("returns empty array for last-prompt type", () => {
      const line = JSON.stringify({ type: "last-prompt", prompt: "do stuff" });
      expect(normalizeTranscriptLine(line)).toEqual([]);
    });

    it("returns empty array for unknown type", () => {
      const line = JSON.stringify({ type: "unknown-future-type" });
      expect(normalizeTranscriptLine(line)).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("returns empty array for malformed JSON (no throw)", () => {
      expect(normalizeTranscriptLine("{bad json")).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(normalizeTranscriptLine("")).toEqual([]);
    });

    it("returns empty array for whitespace-only string", () => {
      expect(normalizeTranscriptLine("   ")).toEqual([]);
    });

    it("returns empty array for non-object JSON", () => {
      expect(normalizeTranscriptLine('"just a string"')).toEqual([]);
    });

    it("returns empty array for null JSON value", () => {
      expect(normalizeTranscriptLine("null")).toEqual([]);
    });
  });

  describe("_key synthesis (T147)", () => {
    it("uses envelope message.id as the key prefix when present", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_abc",
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toHaveLength(1);
      expect(result[0]._key).toBe("msg_abc-0");
    });

    it("includes block index in the key for multi-block assistant envelopes", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_xyz",
          role: "assistant",
          content: [
            { type: "thinking", thinking: "First thought" },
            { type: "text", text: "Final answer" },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toHaveLength(2);
      expect(result[0]._key).toBe("msg_xyz-0");
      expect(result[1]._key).toBe("msg_xyz-1");
    });

    it("falls back to envelope uuid when message.id is absent", () => {
      const line = JSON.stringify({
        type: "assistant",
        uuid: "env-uuid-1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result[0]._key).toBe("env-uuid-1-0");
    });

    it("synthesizes type-subtype-blockIdx-hash8 fallback when no envelope id is present", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result[0]._key).toMatch(/^assistant-text-0-[0-9a-f]{8}$/);
    });

    it("produces deterministic keys — identical input yields identical _key values", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello world" }],
        },
      });
      const a = normalizeTranscriptLine(line);
      const b = normalizeTranscriptLine(line);
      expect(a[0]._key).toBe(b[0]._key);
    });

    it("produces different fallback keys for different content of the same type", () => {
      const lineA = JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "AAA" }] },
      });
      const lineB = JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "BBB" }] },
      });
      const a = normalizeTranscriptLine(lineA);
      const b = normalizeTranscriptLine(lineB);
      expect(a[0]._key).not.toBe(b[0]._key);
    });

    it("uses block-level id when present (preferred over envelope id)", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_envelope",
          role: "assistant",
          content: [
            { type: "tool_use", id: "toolu_inner", name: "Bash", input: {} },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result[0]._key).toBe("toolu_inner-0");
    });

    it("populates _key on user/tool_result events", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          id: "msg_user_1",
          role: "user",
          content: [
            { type: "tool_result", id: "tr_1", content: "ok" },
          ],
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result).toHaveLength(1);
      expect(result[0]._key).toBe("tr_1-0");
    });

    it("populates _key on plain user/string events with deterministic fallback", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: "harness prompt",
        },
      });
      const result = normalizeTranscriptLine(line);
      expect(result[0]._key).toMatch(/^user--0-[0-9a-f]{8}$/);
    });
  });
});
