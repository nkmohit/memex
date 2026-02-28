import { ParsedConversation, ParsedMessage } from "../types.js";

function toMillis(seconds: number | null | undefined): number {
  if (!seconds) return 0;
  return Math.floor(seconds * 1000);
}

function extractTextParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  const textParts = parts
    .filter((part) => typeof part === "string")
    .map((part) => (part as string).trim())
    .filter((part) => part.length > 0);

  if (textParts.length === 0) return null;
  const combined = textParts.join("\n").trim();
  return combined.length > 0 ? combined : null;
}

function flattenConversation(conv: Record<string, unknown>): ParsedMessage[] {
  const mapping = conv.mapping as Record<string, unknown> | undefined;
  const currentNode = conv.current_node as string | undefined;
  const convId = (conv.conversation_id ?? conv.id) as string | undefined;

  if (!mapping || !currentNode || !convId) return [];

  const collected: ParsedMessage[] = [];
  let nodeId: string | null = currentNode;

  while (nodeId) {
    const node = mapping[nodeId] as Record<string, unknown> | undefined;
    if (!node) break;

    const msg = node.message as Record<string, unknown> | undefined;
    if (msg) {
      const author = msg.author as Record<string, unknown> | undefined;
      const role = author?.role as string | undefined;

      if (role === "user" || role === "assistant") {
        const content = msg.content as Record<string, unknown> | undefined;
        const text = extractTextParts(content?.parts);

        if (text) {
          collected.push({
            id: `${convId}_${msg.id as string}`,
            conversationId: convId,
            sender: role === "user" ? "human" : "assistant",
            content: text,
            createdAt: toMillis(msg.create_time as number | null | undefined),
          });
        }
      }
    }

    const parent = node.parent as string | null | undefined;
    nodeId = parent ?? null;
  }

  return collected.reverse();
}

export function parseChatGPTConversations(
  rawJson: unknown[]
): ParsedConversation[] {
  const conversations: ParsedConversation[] = [];

  for (const raw of rawJson) {
    if (typeof raw !== "object" || raw === null) continue;
    const conv = raw as Record<string, unknown>;

    const convId = (conv.conversation_id ?? conv.id) as string | undefined;
    const mapping = conv.mapping as Record<string, unknown> | undefined;
    const currentNode = conv.current_node as string | undefined;

    if (!convId || !mapping || !currentNode) continue;

    const messages = flattenConversation(conv);

    conversations.push({
      id: convId,
      externalId: convId,
      source: "chatgpt",
      title: (conv.title as string | undefined) || "Untitled",
      createdAt: toMillis(conv.create_time as number | null | undefined),
      updatedAt: toMillis(conv.update_time as number | null | undefined),
      messageCount: messages.length,
      messages,
    });
  }

  return conversations.filter((c) => c.messageCount > 0);
}
