import { z } from "zod";

export class ImportValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = "ImportValidationError";
  }
}

export const ParsedMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  sender: z.enum(["human", "assistant"]),
  content: z.string().min(1),
  createdAt: z.number().finite().nonnegative(),
});

export const ParsedConversationSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  messages: z.array(ParsedMessageSchema),
});

export const ParsedConversationArraySchema = z.array(ParsedConversationSchema);

export function validateParsedConversations(data: unknown) {
  const parsed = ParsedConversationArraySchema.safeParse(data);
  if (!parsed.success) {
    throw new ImportValidationError("Invalid parsed conversations", parsed.error.issues);
  }
  return parsed.data as unknown as import("./types.js").ParsedConversation[];
}

// Raw payload schemas — permissive but catch structure errors
const ClaudeRawMessageSchema = z.object({
  uuid: z.string().min(1),
  sender: z.string().min(1),
  text: z.string().optional(),
  content: z.unknown().optional(),
  created_at: z.string().optional(),
});

const ClaudeRawConversationSchema = z
  .object({
    uuid: z.string().min(1),
    name: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    chat_messages: z.array(ClaudeRawMessageSchema).optional(),
  })
  .passthrough();

export const ClaudeImportPayloadSchema = z.array(ClaudeRawConversationSchema);

const ChatGPTRawSchema = z
  .object({
    id: z.string().optional(),
    conversation_id: z.string().optional(),
    title: z.string().optional(),
    mapping: z.record(z.string(), z.unknown()),
    current_node: z.string().min(1),
  })
  .passthrough();

export const ChatGPTImportPayloadSchema = z.array(ChatGPTRawSchema);

export function validateClaudePayload(data: unknown) {
  const parsed = ClaudeImportPayloadSchema.safeParse(data);
  if (!parsed.success)
    throw new ImportValidationError("Invalid Claude payload", parsed.error.issues);
  return parsed.data;
}

export function validateChatGPTPayload(data: unknown) {
  const parsed = ChatGPTImportPayloadSchema.safeParse(data);
  if (!parsed.success)
    throw new ImportValidationError("Invalid ChatGPT payload", parsed.error.issues);
  return parsed.data;
}
