import { ParsedConversation, ParsedMessage } from "../types.js";
import { validateParsedConversations } from "../schemas.js";

function toTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    // seconds vs ms heuristic: < 1e12 is seconds
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function flattenContent(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.text === "string") {
      const trimmed = obj.text.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof obj.content === "string") {
      const trimmed = obj.content.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (Array.isArray(obj.parts)) {
      const parts = obj.parts
        .map((p) => {
          if (typeof p === "string") return p.trim();
          if (
            p &&
            typeof p === "object" &&
            typeof (p as Record<string, unknown>).text === "string"
          ) {
            return ((p as Record<string, unknown>).text as string).trim();
          }
          return "";
        })
        .filter((s) => s.length > 0);
      if (parts.length === 0) return null;
      return parts.join("\n\n");
    }
    if (Array.isArray(obj.content)) {
      const parts = (obj.content as unknown[])
        .map((p) => {
          if (typeof p === "string") return p.trim();
          if (
            p &&
            typeof p === "object" &&
            typeof (p as Record<string, unknown>).text === "string"
          ) {
            return ((p as Record<string, unknown>).text as string).trim();
          }
          return "";
        })
        .filter((s) => s.length > 0);
      if (parts.length === 0) return null;
      return parts.join("\n\n");
    }
  }
  return null;
}

function normalizeRole(role: unknown): "human" | "assistant" | null {
  if (typeof role !== "string") return null;
  const r = role.toLowerCase();
  if (r === "user" || r === "human") return "human";
  if (r === "model" || r === "assistant" || r === "gemini" || r === "bot") return "assistant";
  return null;
}

export function parseGeminiConversations(rawJson: unknown): ParsedConversation[] {
  const sourceArray: unknown[] = (() => {
    if (Array.isArray(rawJson)) return rawJson;
    if (rawJson && typeof rawJson === "object") {
      const obj = rawJson as Record<string, unknown>;
      if (Array.isArray(obj.conversations)) return obj.conversations as unknown[];
      if (Array.isArray(obj.conversation_history)) return obj.conversation_history as unknown[];
      if (Array.isArray(obj.gemini_conversations)) return obj.gemini_conversations as unknown[];
    }
    return [];
  })();

  const conversations: ParsedConversation[] = [];

  for (const raw of sourceArray) {
    if (typeof raw !== "object" || raw === null) continue;
    const conv = raw as Record<string, unknown>;

    const id =
      (conv.conversation_id as string | undefined) ??
      (conv.id as string | undefined) ??
      (conv.uuid as string | undefined) ??
      (conv.conversationId as string | undefined);
    if (!id) continue;

    const title =
      (conv.title as string | undefined) ??
      (conv.name as string | undefined) ??
      (conv.conversation_title as string | undefined) ??
      "Untitled";

    const createdAtRaw = conv.create_time ?? conv.created_at ?? conv.createTime ?? conv.createdAt;
    const updatedAtRaw = conv.update_time ?? conv.updated_at ?? conv.updateTime ?? conv.updatedAt;
    const createdAt = toTimestamp(createdAtRaw);
    const updatedAt = toTimestamp(updatedAtRaw) || createdAt;

    const rawMessages: unknown[] | undefined =
      (conv.messages as unknown[] | undefined) ??
      (conv.chat_messages as unknown[] | undefined) ??
      (conv.turns as unknown[] | undefined);

    if (!Array.isArray(rawMessages)) continue;

    const messages: ParsedMessage[] = [];
    for (const rawMsg of rawMessages) {
      if (typeof rawMsg !== "object" || rawMsg === null) continue;
      const msg = rawMsg as Record<string, unknown>;

      const msgId =
        (msg.id as string | undefined) ??
        (msg.message_id as string | undefined) ??
        (msg.messageId as string | undefined) ??
        (msg.uuid as string | undefined);
      if (!msgId) continue;

      const roleRaw =
        msg.role ?? msg.sender ?? msg.author ?? (msg.author as Record<string, unknown>)?.role;
      const role = normalizeRole(roleRaw);
      if (!role) continue;

      const contentRaw = msg.content ?? msg.text ?? msg.parts ?? msg.body;
      // Also check nested message.content
      const content = flattenContent(contentRaw ?? msg);
      if (!content) continue;

      const createdRaw =
        msg.create_time ?? msg.created_at ?? msg.createTime ?? msg.timestamp ?? msg.createdAt;
      const createdAtMsg = toTimestamp(createdRaw);

      messages.push({
        id: `${id}_${msgId}`,
        conversationId: id,
        sender: role,
        content,
        createdAt: createdAtMsg,
      });
    }

    if (messages.length === 0 && rawMessages.length > 0) {
      // If all messages filtered, skip conversation unless we want to keep empty? Skip to match claude behavior (skip empty? Actually claude keeps empty conversations, but gemini should filter)
      // Keep conversation even if 0 messages? Let's skip empty to avoid noise
      continue;
    }

    conversations.push({
      id,
      externalId: id,
      source: "gemini",
      title: String(title || "Untitled"),
      createdAt,
      updatedAt,
      messageCount: messages.length,
      messages,
    });
  }

  return validateParsedConversations(conversations);
}
