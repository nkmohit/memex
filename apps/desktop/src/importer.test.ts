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

  it("marks gemini and grok as available (now implemented)", () => {
    const gemini = IMPORT_SOURCES.find((s) => s.id === "gemini");
    const grok = IMPORT_SOURCES.find((s) => s.id === "grok");
    expect(gemini?.available).toBe(true);
    expect(grok?.available).toBe(true);
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

  it("successfully imports valid Gemini export", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        conversation_id: "g1",
        title: "Gemini Test",
        create_time: "2026-01-01T00:00:00Z",
        messages: [
          { id: "m1", role: "user", content: "Hello Gemini" },
          { id: "m2", role: "model", content: "Hi!" },
        ],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/gemini.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const result = await importConversations("gemini");
    expect(result?.source).toBe("gemini");
    expect(result?.conversationCount).toBe(1);
  });

  it("successfully imports valid Grok export", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        conversation_id: "k1",
        title: "Grok Test",
        create_time: 1704067200,
        messages: [
          { message_id: "m1", sender: "user", text: "Hello Grok" },
          { message_id: "m2", sender: "assistant", text: "Hi!" },
        ],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/grok.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const result = await importConversations("grok");
    expect(result?.source).toBe("grok");
    expect(result?.conversationCount).toBe(1);
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
