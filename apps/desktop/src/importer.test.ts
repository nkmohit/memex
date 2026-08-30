import { describe, it, expect, vi, beforeEach } from "vitest";
import { IMPORT_SOURCES, importConversations } from "./importer";

// Mock Tauri dialog/fs and dbInsert
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => "[]"),
}));
vi.mock("./dbInsert", () => ({
  insertConversations: vi.fn(async () => ({ conversationCount: 1, messageCount: 2 })),
}));

// Mock Database load used by markDataChanged? importer calls markDataChanged indirectly via db module?
// But importConversations itself only calls insertConversations and does not call markDataChanged.
// So we just need dialog/fs mocks.

describe("IMPORT_SOURCES registry", () => {
  it("contains expected sources", () => {
    const ids = IMPORT_SOURCES.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["claude", "chatgpt", "gemini", "grok"]));
  });

  it("marks claude and chatgpt as available", () => {
    const claude = IMPORT_SOURCES.find((s) => s.id === "claude");
    const chatgpt = IMPORT_SOURCES.find((s) => s.id === "chatgpt");
    expect(claude?.available).toBe(true);
    expect(chatgpt?.available).toBe(true);
  });

  it("marks gemini and grok as not yet available", () => {
    const gemini = IMPORT_SOURCES.find((s) => s.id === "gemini");
    const grok = IMPORT_SOURCES.find((s) => s.id === "grok");
    expect(gemini?.available).toBe(false);
    expect(grok?.available).toBe(false);
  });

  it("all sources have non-empty label", () => {
    for (const src of IMPORT_SOURCES) {
      expect(src.label.length).toBeGreaterThan(0);
    }
  });
});

describe("importConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws for unavailable gemini importer", async () => {
    await expect(importConversations("gemini" as any)).rejects.toThrow(/not available yet/i);
  });

  it("throws for grok template (not implemented)", async () => {
    // grok case opens dialog then throws; if dialog returns null it returns null, otherwise throws
    // With our mock returning null, grok should return null (user cancelled). Let's check behavior:
    // In importer.ts grok does open then checks !filePath return null before throwing.
    // So with open mocked to null, it should return null, not throw.
    // But if file is selected, it would throw.
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    const result = await importConversations("grok");
    expect(result).toBeNull();
  });

  it("throws for grok when file is selected but parsing not implemented", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce("/tmp/grok.json");
    await expect(importConversations("grok")).rejects.toThrow(/not implemented yet/i);
  });

  it("returns null when user cancels Claude file dialog", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    const result = await importConversations("claude");
    expect(result).toBeNull();
  });

  it("returns null when user cancels ChatGPT file dialog", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    const result = await importConversations("chatgpt");
    expect(result).toBeNull();
  });

  it("throws for Claude invalid export (non-array)", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/claude.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify({ not: "an array" }));
    await expect(importConversations("claude")).rejects.toThrow(/Invalid Claude export/i);
  });

  it("successfully imports valid Claude export and returns counts", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        uuid: "conv-1",
        name: "Test Conversation",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        chat_messages: [
          {
            uuid: "msg-1",
            sender: "human",
            created_at: "2026-01-01T00:00:00Z",
            text: "Hello",
          },
          {
            uuid: "msg-2",
            sender: "assistant",
            created_at: "2026-01-01T00:01:00Z",
            text: "Hi there",
          },
        ],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/claude.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const result = await importConversations("claude");
    expect(result).not.toBeNull();
    expect(result?.source).toBe("claude");
    expect(result?.conversationCount).toBe(1);
    expect(result?.messageCount).toBe(2);
  });

  it("throws when Claude export has no conversations", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/claude.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify([]));
    await expect(importConversations("claude")).rejects.toThrow(/No conversations found/i);
  });

  it("reports progress via onProgress callback", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        uuid: "conv-2",
        name: "Another",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        chat_messages: [
          { uuid: "msg-3", sender: "human", created_at: "2026-01-01T00:00:00Z", text: "Hi" },
        ],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/claude.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const onProgress = vi.fn();
    await importConversations("claude", { onProgress });
    expect(onProgress).toHaveBeenCalled();
    const firstCall = onProgress.mock.calls[0][0];
    expect(firstCall.phase).toBe("parse");
    expect(firstCall.conversationsTotal).toBe(1);
  });

  it("throws for unknown source", async () => {
    await expect(importConversations("unknown" as any)).rejects.toThrow(/not available/i);
  });
});
