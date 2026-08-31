import { z } from "zod";
import { clampLimit, clampOffset, isValidTimestamp, sanitizeSource } from "./validation";

export class ImportValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[]
  ) {
    super(message);
    this.name = "ImportValidationError";
  }
}

const ParsedMessageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  sender: z.enum(["human", "assistant"]),
  content: z.string().min(1),
  createdAt: z.number().finite().nonnegative(),
});

const ParsedConversationSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: z.enum(["claude", "chatgpt", "gemini", "grok"]),
  title: z.string().min(1),
  createdAt: z.number().finite().nonnegative(),
  updatedAt: z.number().finite().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  messages: z.array(ParsedMessageSchema),
});

export const ParsedConversationArraySchema = z.array(ParsedConversationSchema);

export const SearchOptionsSchema = z.object({
  source: z
    .string()
    .optional()
    .transform((v) => (v ? sanitizeSource(v) : undefined))
    .optional(),
  dateFrom: z
    .number()
    .optional()
    .refine((v) => v === undefined || isValidTimestamp(v), {
      message: "Invalid dateFrom timestamp",
    }),
  dateTo: z
    .number()
    .optional()
    .refine((v) => v === undefined || isValidTimestamp(v), {
      message: "Invalid dateTo timestamp",
    }),
  limit: z
    .unknown()
    .optional()
    .transform((v) => (v === undefined ? undefined : clampLimit(v))),
  offset: z
    .unknown()
    .optional()
    .transform((v) => (v === undefined ? undefined : clampOffset(v))),
  sort: z
    .enum(["relevance", "last_occurrence_desc", "occurrence_count_desc", "title_az", "title_za"])
    .optional()
    .default("last_occurrence_desc"),
  mode: z.enum(["fts", "semantic", "hybrid"]).optional().default("fts"),
});

export type ValidatedSearchOptions = z.infer<typeof SearchOptionsSchema>;

// Raw import schemas — permissive but catch malformed
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
    create_time: z.number().optional(),
    update_time: z.number().optional(),
    mapping: z.record(z.string(), z.unknown()),
    current_node: z.string().min(1),
  })
  .passthrough();

export const ChatGPTImportPayloadSchema = z.array(ChatGPTRawSchema);

const GeminiRawSchema = z.object({}).passthrough();
export const GeminiImportPayloadSchema = z.union([
  z.array(GeminiRawSchema),
  z
    .object({
      conversations: z.array(GeminiRawSchema).optional(),
      conversation_history: z.array(GeminiRawSchema).optional(),
      gemini_conversations: z.array(GeminiRawSchema).optional(),
    })
    .passthrough(),
]);

export function validateParsedConversations(
  data: unknown
): z.infer<typeof ParsedConversationArraySchema> {
  const parsed = ParsedConversationArraySchema.safeParse(data);
  if (!parsed.success) {
    throw new ImportValidationError("Invalid parsed conversations", parsed.error.issues);
  }
  return parsed.data;
}

export function validateSearchOptions(opts: unknown): ValidatedSearchOptions {
  const parsed = SearchOptionsSchema.safeParse(opts ?? {});
  if (!parsed.success) {
    throw new ImportValidationError("Invalid search options", parsed.error.issues);
  }
  // zod default handling ensures sort/mode defaults
  return parsed.data as ValidatedSearchOptions;
}

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
