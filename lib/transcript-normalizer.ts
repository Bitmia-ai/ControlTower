import { ClaudeStreamEvent } from "./redeye-types";

/** A single content block from the CLI transcript assistant message. */
interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  /**
   * Some Claude API content blocks (notably tool_use and tool_result) carry
   * their own `id` distinct from the message envelope's id. Used as a key
   * salt when present.
   */
  id?: string;
}

/** Raw CLI transcript envelope line. */
interface TranscriptEnvelope {
  type: string;
  /**
   * Top-level envelope identifier. Some CLI transcripts attach a `uuid` at
   * the envelope, separate from `message.id`. Either is acceptable as the
   * key salt.
   */
  uuid?: string;
  message?: {
    /** Anthropic API message id, e.g. `msg_01XFDUDYJgAACTJCmUMHffnZ`. */
    id?: string;
    role?: string;
    content?: ContentBlock[] | string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

/**
 * Compact, deterministic 8-char djb2 hash of a string. Pure JS, no
 * dependencies. Used as the content-distinguishing suffix when the source
 * envelope carries no id and we need to disambiguate adjacent cards of the
 * same type+subtype.
 *
 * djb2 chosen for its simplicity and well-known distribution; cryptographic
 * strength is not required — collisions only cause React-key collisions
 * within a single render pass for adjacent identical content, which is
 * acceptable.
 */
function djb2Hash8(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + char, kept inside 32-bit range
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  // Convert to unsigned and zero-pad to 8 hex chars
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

/**
 * Synthesize a stable key for a content block in a transcript envelope.
 *
 * Priority:
 *   1. `${envelopeId}-${blockIndex}` — fully stable across replays of the
 *      same session, preferred when the source envelope carries an `id`
 *      (or the block carries its own `id`).
 *   2. `${type}-${subtype}-${blockIndex}-${djb2(contentSeed)}` — fallback
 *      for envelopes without an id; deterministic for identical input,
 *      enough to distinguish adjacent cards.
 */
function synthesizeKey(args: {
  envelopeId: string | undefined;
  blockId: string | undefined;
  blockIndex: number;
  type: string;
  subtype: string | undefined;
  contentSeed: string;
}): string {
  const { envelopeId, blockId, blockIndex, type, subtype, contentSeed } = args;
  const id = blockId ?? envelopeId;
  if (id) {
    return `${id}-${blockIndex}`;
  }
  const sub = subtype ?? "";
  return `${type}-${sub}-${blockIndex}-${djb2Hash8(contentSeed)}`;
}

/**
 * Normalize a raw JSONL line from the Claude CLI transcript format into one or
 * more ClaudeStreamEvents, or an empty array to skip the line.
 *
 * Returns an array because a single assistant envelope can carry multiple
 * content blocks (e.g. thinking + text) that each map to a distinct event.
 *
 * Maps the CLI envelope format described in T013 AD-2 to the
 * ClaudeStreamEvent shape used by TranscriptViewer.
 */
export function normalizeTranscriptLine(raw: string): ClaudeStreamEvent[] {
  if (!raw || !raw.trim()) return [];

  let envelope: TranscriptEnvelope;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    envelope = parsed as TranscriptEnvelope;
  } catch {
    return [];
  }

  const { type, message } = envelope;
  // Salt for keys: prefer the inner message id (Anthropic API), fall back to
  // the envelope `uuid`. Either is stable across replays of the same session.
  const envelopeId = message?.id ?? envelope.uuid;

  if (type === "assistant") {
    return normalizeAssistant(message, envelopeId);
  }

  if (type === "user") {
    const event = normalizeUser(message, envelopeId);
    return event ? [event] : [];
  }

  // attachment, permission-mode, queue-operation, last-prompt and any other types → skip
  return [];
}

function normalizeAssistant(
  message: TranscriptEnvelope["message"],
  envelopeId: string | undefined
): ClaudeStreamEvent[] {
  if (!message || !Array.isArray(message.content) || message.content.length === 0) {
    return [];
  }

  const usage = message.usage
    ? {
        input_tokens: message.usage.input_tokens ?? 0,
        output_tokens: message.usage.output_tokens ?? 0,
        cache_read_input_tokens: message.usage.cache_read_input_tokens,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
      }
    : undefined;

  const events: ClaudeStreamEvent[] = [];
  const blocks = message.content as ContentBlock[];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    if (block.type === "text" && block.text !== undefined) {
      const _key = synthesizeKey({
        envelopeId,
        blockId: block.id,
        blockIndex,
        type: "assistant",
        subtype: "text",
        contentSeed: block.text,
      });
      events.push({ type: "assistant", subtype: "text", content: block.text, usage, _key });
    } else if (block.type === "thinking" && block.thinking !== undefined) {
      const _key = synthesizeKey({
        envelopeId,
        blockId: block.id,
        blockIndex,
        type: "assistant",
        subtype: "thinking",
        contentSeed: block.thinking,
      });
      events.push({ type: "assistant", subtype: "thinking", content: block.thinking, usage, _key });
    } else if (block.type === "tool_use" && block.name !== undefined) {
      const _key = synthesizeKey({
        envelopeId,
        blockId: block.id,
        blockIndex,
        type: "assistant",
        subtype: "tool_use",
        contentSeed: block.name,
      });
      events.push({
        type: "assistant",
        subtype: "tool_use",
        tool_name: block.name,
        tool_input: block.input ?? {},
        usage,
        _key,
      });
    }
  }

  return events;
}

function normalizeUser(
  message: TranscriptEnvelope["message"],
  envelopeId: string | undefined
): ClaudeStreamEvent | null {
  if (!message) return null;

  const { content } = message;

  // String content
  if (typeof content === "string") {
    const _key = synthesizeKey({
      envelopeId,
      blockId: undefined,
      blockIndex: 0,
      type: "user",
      subtype: undefined,
      contentSeed: content,
    });
    return { type: "user", content, _key };
  }

  // Array content
  if (Array.isArray(content) && content.length > 0) {
    const blocks = content as ContentBlock[];

    // Check for tool_result first
    const toolResultIdx = blocks.findIndex((b) => b.type === "tool_result");
    if (toolResultIdx >= 0) {
      const toolResult = blocks[toolResultIdx];
      // toolResult.content can be a string or an array of {type, text} blocks
      let resultContent = "";
      if (typeof toolResult.content === "string") {
        resultContent = toolResult.content;
      } else if (Array.isArray(toolResult.content)) {
        // Extract text from content blocks
        resultContent = (toolResult.content as ContentBlock[])
          .filter((b) => b.type === "text" && b.text !== undefined)
          .map((b) => b.text ?? "")
          .join("\n");
      }
      const _key = synthesizeKey({
        envelopeId,
        blockId: toolResult.id,
        blockIndex: toolResultIdx,
        type: "user",
        subtype: "tool_result",
        contentSeed: resultContent,
      });
      return {
        type: "user",
        subtype: "tool_result",
        content: resultContent,
        _key,
      };
    }

    // Fallback: text block
    const textIdx = blocks.findIndex((b) => b.type === "text" && b.text !== undefined);
    if (textIdx >= 0) {
      const textBlock = blocks[textIdx];
      const _key = synthesizeKey({
        envelopeId,
        blockId: textBlock.id,
        blockIndex: textIdx,
        type: "user",
        subtype: undefined,
        contentSeed: textBlock.text ?? "",
      });
      return { type: "user", content: textBlock.text, _key };
    }
  }

  return null;
}
