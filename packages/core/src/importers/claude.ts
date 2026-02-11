import { ParsedConversation, ParsedMessage } from "../types.js";

/**
 * Convert an ISO date string to a Unix timestamp (milliseconds).
 */
function toTimestamp(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Flatten a Claude message's content into a single string.
 *
 * Rules:
 * 1. If `text` field exists on the message, use it directly.
 * 2. Otherwise, filter content blocks where type === "text", join with "\n\n".
 * 3. Trim the result.
 * 4. Return null if empty (caller should skip).
 */
function flattenContent(message: Record<string, unknown>): string | null {
  // Rule 1: direct text field
  if (typeof message.text === "string") {
    const trimmed = message.text.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  // Rule 2: content blocks array
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter(
        (block: unknown) =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>).type === "text" &&
          typeof (block as Record<string, unknown>).text === "string"
      )
      .map((block: unknown) => ((block as Record<string, unknown>).text as string).trim())
      .filter((t: string) => t.length > 0);

    if (textParts.length === 0) return null;
    return textParts.join("\n\n");
  }

  return null;
}

/**
 * Parse raw Claude export JSON into canonical ParsedConversation[].
 *
 * This is a PURE function — no side effects, no DB, no I/O.
 * Input: the raw array from Claude's conversations.json export.
 * Output: clean domain objects ready for storage.
 */
export function parseClaudeConversations(
  rawJson: unknown[]
): ParsedConversation[] {
  const conversations: ParsedConversation[] = [];

  for (const raw of rawJson) {
    if (typeof raw !== "object" || raw === null) continue;

    const conv = raw as Record<string, unknown>;
    const uuid = conv.uuid as string | undefined;
    const name = conv.name as string | undefined;
    const createdAt = conv.created_at as string | undefined;
    const updatedAt = conv.updated_at as string | undefined;
    const chatMessages = conv.chat_messages as unknown[] | undefined;

    if (!uuid || !chatMessages || !Array.isArray(chatMessages)) continue;

    const messages: ParsedMessage[] = [];

    for (const rawMsg of chatMessages) {
      if (typeof rawMsg !== "object" || rawMsg === null) continue;

      const msg = rawMsg as Record<string, unknown>;
      const msgUuid = msg.uuid as string | undefined;
      const sender = msg.sender as string | undefined;
      const msgCreatedAt = msg.created_at as string | undefined;

      if (!msgUuid || !sender) continue;
      if (sender !== "human" && sender !== "assistant") continue;

      const content = flattenContent(msg);
      if (!content) continue;

      messages.push({
        id: `${uuid}_${msgUuid}`,
        conversationId: uuid,
        sender: sender as "human" | "assistant",
        content,
        createdAt: msgCreatedAt ? toTimestamp(msgCreatedAt) : 0,
      });
    }

    conversations.push({
      id: uuid,
      externalId: uuid,
      source: "claude",
      title: name || "Untitled",
      createdAt: createdAt ? toTimestamp(createdAt) : 0,
      updatedAt: updatedAt ? toTimestamp(updatedAt) : 0,
      messageCount: messages.length,
      messages,
    });
  }

  return conversations;
}
