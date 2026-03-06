import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parseChatGPTConversations, parseClaudeConversations } from "@memex/core";
import { insertConversations } from "./dbInsert";

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
  { id: "gemini", label: "Gemini", available: false },
  { id: "grok", label: "Grok", available: false },
];

// ---------------------------------------------------------------------------
// Import result
// ---------------------------------------------------------------------------

export interface ImportResult {
  source: ImportSource;
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
  source: ImportSource,
  opts: ImportOptions = {}
): Promise<ImportResult | null> {
  switch (source) {
    case "claude":
      return importClaude(opts);
    case "chatgpt":
      return importChatGPT(opts);
    case "grok":
      return importGrok();
    default:
      throw new Error(`Importer for "${source}" is not available yet.`);
  }
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
    throw new Error(
      "Invalid Claude export: expected a JSON array of conversations"
    );
  }

  const parsed = parseClaudeConversations(rawData);
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

  console.log(
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
    throw new Error(
      "Invalid OpenAI / ChatGPT export: expected a JSON array of conversations"
    );
  }

  const parsed = parseChatGPTConversations(rawData);
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

  console.log(
    `OpenAI / ChatGPT import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return {
    source: "chatgpt",
    ...result,
  };
}

// ---------------------------------------------------------------------------
// Grok importer (template)
// ---------------------------------------------------------------------------

async function importGrok(): Promise<ImportResult | null> {
  const filePath = await open({
    title: "Select Grok Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  // TODO: Once implemented, parse the export into ParsedConversation[]
  // and insert into the database:
  //
  // const content = await readTextFile(filePath as string);
  // const rawData = JSON.parse(content);
  // const parsed = parseGrokConversations(rawData);
  // if (parsed.length === 0) {
  //   throw new Error("No conversations found in the export file");
  // }
  // const result = await insertConversations(parsed);
  // console.log(
  //   `Grok import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  // );
  // return {
  //   source: "grok",
  //   ...result,
  // };

  throw new Error(
    "Grok importer template is in place, but parsing is not implemented yet."
  );
}
