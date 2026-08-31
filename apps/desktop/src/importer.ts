import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  parseChatGPTConversations,
  parseClaudeConversations,
  parseGeminiConversations,
  parseGrokConversations,
  validateParsedConversations,
  ImportValidationError,
} from "@memex/core";
import { insertConversations } from "./dbInsert";
import { logger } from "./lib/logger";
import { getPluginParser, type ParserFn } from "./plugins/registry";
import { validateClaudePayload, validateChatGPTPayload } from "./lib/schemas";

// ---------------------------------------------------------------------------
// Source registry — add new sources here as they become available
// ---------------------------------------------------------------------------

export type ImportSource = "claude" | "chatgpt" | "gemini" | "grok";

export interface SourceMeta {
  id: ImportSource;
  label: string;
  available: boolean;
}

export const IMPORT_SOURCES: SourceMeta[] = [
  { id: "claude", label: "Claude", available: true },
  { id: "chatgpt", label: "ChatGPT", available: true },
  { id: "gemini", label: "Gemini", available: true },
  { id: "grok", label: "Grok", available: true },
];

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface ImportResult {
  source: ImportSource | string;
  conversationCount: number;
  messageCount: number;
  cancelled?: boolean;
}

export interface ImportProgress {
  phase: "parse" | "write";
  conversationsDone: number;
  conversationsTotal: number;
  messagesDone: number;
  messagesTotal?: number;
}

export interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function importConversations(
  source: ImportSource | string,
  opts: ImportOptions = {}
): Promise<ImportResult | null> {
  switch (source) {
    case "claude":
      return importClaude(opts);
    case "chatgpt":
      return importChatGPT(opts);
    case "gemini":
      return importGemini(opts);
    case "grok":
      return importGrok(opts);
    default: {
      const pluginParser = getPluginParser(source);
      if (pluginParser) return importPlugin(source, pluginParser, opts);
      throw new Error(`Importer for "${source}" is not available yet.`);
    }
  }
}

async function importPlugin(
  sourceId: string,
  parser: ParserFn,
  opts: ImportOptions
): Promise<ImportResult | null> {
  const filePath = await open({
    title: `Select ${sourceId} Export JSON`,
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });
  if (!filePath) return null;
  const content = await readTextFile(filePath as string);
  const rawData = JSON.parse(content);
  const parsed = parser(rawData as unknown) as unknown as ReturnType<
    typeof parseClaudeConversations
  >;
  validateParsedConversations(parsed as unknown);
  opts.onProgress?.({
    phase: "parse",
    conversationsDone: parsed.length,
    conversationsTotal: parsed.length,
    messagesDone: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
    messagesTotal: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
  });
  if (parsed.length === 0) throw new Error("No conversations found in the export file");
  const result = await insertConversations(parsed, {
    signal: opts.signal,
    onProgress: opts.onProgress,
  });
  logger.info(
    `Plugin ${sourceId} import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );
  return { source: sourceId as ImportSource, ...result };
}

// ---------------------------------------------------------------------------
// Claude importer
// ---------------------------------------------------------------------------

async function importClaude(opts: ImportOptions): Promise<ImportResult | null> {
  const filePath = await open({
    title: "Select Claude Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  const content = await readTextFile(filePath as string);
  const rawData = JSON.parse(content);

  if (!Array.isArray(rawData)) {
    throw new ImportValidationError(
      "Invalid Claude export: expected a JSON array of conversations",
      []
    );
  }
  // Schema validation at import boundary
  validateClaudePayload(rawData);
  const parsed = parseClaudeConversations(rawData);
  validateParsedConversations(parsed);
  opts.onProgress?.({
    phase: "parse",
    conversationsDone: parsed.length,
    conversationsTotal: parsed.length,
    messagesDone: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
    messagesTotal: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
  });

  if (parsed.length === 0) {
    throw new Error("No conversations found in the export file");
  }

  const result = await insertConversations(parsed, {
    signal: opts.signal,
    onProgress: opts.onProgress,
  });

  logger.info(
    `Claude import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return {
    source: "claude",
    ...result,
  };
}

// ---------------------------------------------------------------------------
// OpenAI / ChatGPT importer (template)
// ---------------------------------------------------------------------------

async function importChatGPT(opts: ImportOptions): Promise<ImportResult | null> {
  const filePath = await open({
    title: "Select OpenAI / ChatGPT Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  const content = await readTextFile(filePath as string);
  const rawData = JSON.parse(content);

  if (!Array.isArray(rawData)) {
    throw new ImportValidationError(
      "Invalid OpenAI / ChatGPT export: expected a JSON array of conversations",
      []
    );
  }
  validateChatGPTPayload(rawData);
  const parsed = parseChatGPTConversations(rawData);
  validateParsedConversations(parsed);
  opts.onProgress?.({
    phase: "parse",
    conversationsDone: parsed.length,
    conversationsTotal: parsed.length,
    messagesDone: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
    messagesTotal: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
  });

  if (parsed.length === 0) {
    throw new Error("No conversations found in the export file");
  }

  const result = await insertConversations(parsed, {
    signal: opts.signal,
    onProgress: opts.onProgress,
  });

  logger.info(
    `OpenAI / ChatGPT import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return {
    source: "chatgpt",
    ...result,
  };
}

// ---------------------------------------------------------------------------
// Gemini importer
// ---------------------------------------------------------------------------

async function importGemini(opts: ImportOptions): Promise<ImportResult | null> {
  const filePath = await open({
    title: "Select Gemini Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  const content = await readTextFile(filePath as string);
  const rawData = JSON.parse(content);

  const parsed = parseGeminiConversations(rawData);
  validateParsedConversations(parsed);

  opts.onProgress?.({
    phase: "parse",
    conversationsDone: parsed.length,
    conversationsTotal: parsed.length,
    messagesDone: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
    messagesTotal: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
  });

  if (parsed.length === 0) {
    throw new Error("No conversations found in the export file");
  }

  const result = await insertConversations(parsed, {
    signal: opts.signal,
    onProgress: opts.onProgress,
  });

  logger.info(
    `Gemini import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return {
    source: "gemini",
    ...result,
  };
}

// ---------------------------------------------------------------------------
// Grok importer
// ---------------------------------------------------------------------------

async function importGrok(opts: ImportOptions): Promise<ImportResult | null> {
  const filePath = await open({
    title: "Select Grok Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  const content = await readTextFile(filePath as string);
  const rawData = JSON.parse(content);

  const parsed = parseGrokConversations(rawData);
  validateParsedConversations(parsed);

  opts.onProgress?.({
    phase: "parse",
    conversationsDone: parsed.length,
    conversationsTotal: parsed.length,
    messagesDone: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
    messagesTotal: parsed.reduce((sum, conv) => sum + conv.messages.length, 0),
  });

  if (parsed.length === 0) {
    throw new Error("No conversations found in the export file");
  }

  const result = await insertConversations(parsed, {
    signal: opts.signal,
    onProgress: opts.onProgress,
  });

  logger.info(
    `Grok import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return {
    source: "grok",
    ...result,
  };
}
