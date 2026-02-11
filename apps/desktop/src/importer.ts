import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parseClaudeConversations } from "@memex/core";
import { insertConversations } from "./dbInsert";

export interface ImportResult {
  conversationCount: number;
  messageCount: number;
}

/**
 * Orchestrates the full Claude import flow:
 * 1. Open file picker (JSON only)
 * 2. Read file contents
 * 3. Parse with pure core parser
 * 4. Insert into SQLite
 *
 * Returns null if the user cancelled the file picker.
 */
export async function importClaudeConversations(): Promise<ImportResult | null> {
  // Step 1: File picker
  const filePath = await open({
    title: "Select Claude Export JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
    directory: false,
  });

  if (!filePath) return null;

  // Step 2: Read file
  const content = await readTextFile(filePath as string);

  // Step 3: Parse JSON and run through pure parser
  const rawData = JSON.parse(content);

  if (!Array.isArray(rawData)) {
    throw new Error(
      "Invalid Claude export: expected a JSON array of conversations"
    );
  }

  const parsed = parseClaudeConversations(rawData);

  if (parsed.length === 0) {
    throw new Error("No conversations found in the export file");
  }

  // Step 4: Insert into DB
  const result = await insertConversations(parsed);

  console.log(
    `Import complete: ${result.conversationCount} conversations, ${result.messageCount} messages`
  );

  return result;
}
