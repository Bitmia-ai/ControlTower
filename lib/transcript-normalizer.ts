import { ClaudeStreamEvent } from "./redeye-types";

/** A single content block from the CLI transcript assistant message. */
interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

/** Raw CLI transcript envelope line. */
interface TranscriptEnvelope {
  type: string;
  message?: {
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
 * Normalize a raw JSONL line from the Claude CLI transcript format into one or
 * more ClaudeStreamEvents, or an empty array to skip the line.
 *
 * Returns an array because a single assistant envelope can carry multiple
 * content blocks (e.g. thinking + text) that each map to a distinct event.
 *
 * Maps the CLI envelope format described in BL-013 AD-2 to the
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

  if (type === "assistant") {
    return normalizeAssistant(message);
  }

  if (type === "user") {
    const event = normalizeUser(message);
    return event ? [event] : [];
  }

  // attachment, permission-mode, queue-operation, last-prompt and any other types → skip
  return [];
}

function normalizeAssistant(
  message: TranscriptEnvelope["message"]
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
  for (const block of blocks) {
    if (block.type === "text" && block.text !== undefined) {
      events.push({ type: "assistant", subtype: "text", content: block.text, usage });
    } else if (block.type === "thinking" && block.thinking !== undefined) {
      events.push({ type: "assistant", subtype: "thinking", content: block.thinking, usage });
    } else if (block.type === "tool_use" && block.name !== undefined) {
      events.push({
        type: "assistant",
        subtype: "tool_use",
        tool_name: block.name,
        tool_input: block.input ?? {},
        usage,
      });
    }
  }

  return events;
}

function normalizeUser(
  message: TranscriptEnvelope["message"]
): ClaudeStreamEvent | null {
  if (!message) return null;

  const { content } = message;

  // String content
  if (typeof content === "string") {
    return { type: "user", content };
  }

  // Array content
  if (Array.isArray(content) && content.length > 0) {
    const blocks = content as ContentBlock[];

    // Check for tool_result first
    const toolResult = blocks.find((b) => b.type === "tool_result");
    if (toolResult) {
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
      return {
        type: "user",
        subtype: "tool_result",
        content: resultContent,
      };
    }

    // Fallback: text block
    const textBlock = blocks.find((b) => b.type === "text" && b.text !== undefined);
    if (textBlock) {
      return { type: "user", content: textBlock.text };
    }
  }

  return null;
}
