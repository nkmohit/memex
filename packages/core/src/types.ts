export interface ParsedConversation {
  id: string;
  externalId: string;
  source: "claude";
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  messages: ParsedMessage[];
}

export interface ParsedMessage {
  id: string;
  conversationId: string;
  sender: "human" | "assistant";
  content: string;
  createdAt: number;
}
