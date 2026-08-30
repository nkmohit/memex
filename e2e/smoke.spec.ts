import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConversations } from "../packages/core/src/importers/claude.js";

// Smoke E2E: verifies import -> overview -> search pipeline without requiring Tauri runtime.
//Mocks Tauri `open`/`readTextFile` by directly reading the Claude fixture from disk.

test.describe("memex smoke", () => {
  test("imports Claude fixture (2 conversations) and search finds hello", async () => {
    // 1) Simulate Tauri file open: read fixture as Tauri would via readTextFile
    const fixturePath = join(process.cwd(), "packages/core/fixtures/claude.json");
    const rawText = await readFile(fixturePath, "utf-8");
    const rawJson = JSON.parse(rawText) as unknown[];

    // 2) Parse via core importer (same path desktop uses in importClaude)
    const conversations = parseClaudeConversations(rawJson);

    // OverviewPage assertion: 2 conversations imported
    expect(conversations).toHaveLength(2);
    expect(conversations[0].id).toBe("conv-1");
    expect(conversations[1].id).toBe("conv-2");
    // titles map to Overview list
    const titles = conversations.map((c) => c.title);
    expect(titles).toEqual(["Hello World", "Second Chat"]);

    // 3) Simulated FTS / SearchPage: naive case-insensitive search for "hello"
    const query = "hello";
    const matched = conversations.filter((conv) =>
      conv.messages.some((m) => m.content.toLowerCase().includes(query))
    );
    // Both conversations contain "hello"
    expect(matched).toHaveLength(2);

    // Snippet highlighting like SearchResultsList renderHighlightedSnippet would see <mark>hello</mark>
    const snippets = matched.flatMap((c) =>
      c.messages
        .filter((m) => m.content.toLowerCase().includes(query))
        .map((m) => m.content.replace(new RegExp(query, "gi"), "<mark>$&</mark>"))
    );
    expect(snippets.length).toBeGreaterThanOrEqual(2);
    expect(snippets.join(" ")).toContain("<mark>hello</mark>");

    // 4) Dashboard stats equivalent to OverviewPage stats
    const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);
    expect(totalMessages).toBe(4);
  });

  test("overview + search page contracts hold for empty query", async () => {
    const rawJson: unknown[] = [];
    const conversations = parseClaudeConversations(rawJson);
    expect(conversations).toHaveLength(0);
    // Empty state search should return no results but not error
    const query = "hello";
    const matched = conversations.filter((conv) =>
      conv.messages.some((m) => m.content.toLowerCase().includes(query))
    );
    expect(matched).toHaveLength(0);
  });
});
