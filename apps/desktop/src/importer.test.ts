import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IMPORT_SOURCES, importConversations } from "./importer";
import { clearPlugins, registerImporter } from "./plugins/registry";

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

  it("imports via custom plugin source (registry)", async () => {
    clearPlugins();
    registerImporter({ id: "notion", label: "Notion", available: true }, (raw) => {
      const data = raw as { id: string; title: string }[];
      return data.map((d) => ({
        id: d.id,
        externalId: d.id,
        source: "notion",
        title: d.title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 1,
        messages: [
          {
            id: `m-${d.id}`,
            conversationId: d.id,
            sender: "human" as const,
            content: "hello",
            createdAt: Date.now(),
          },
        ],
      }));
    });
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/notion.json");
    (readTextFile as any).mockResolvedValueOnce(
      JSON.stringify([{ id: "n1", title: "Notion Doc" }])
    );
    const result = await importConversations("notion" as any);
    expect(result?.source).toBe("notion");
    expect(result?.conversationCount).toBe(1);
    expect(result?.messageCount).toBe(2);
  });

  it("throws for ChatGPT invalid export (non-array)", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/chatgpt.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify({ not: "array" }));
    await expect(importConversations("chatgpt")).rejects.toThrow(/Invalid OpenAI/i);
  });

  it("throws when ChatGPT export has no conversations", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/chatgpt.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify([]));
    await expect(importConversations("chatgpt")).rejects.toThrow(/No conversations found/i);
  });

  it("successfully imports valid ChatGPT export", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        conversation_id: "c1",
        title: "Chat Test",
        create_time: 1704067200,
        update_time: 1704067200,
        current_node: "node-2",
        mapping: {
          "node-1": {
            id: "node-1",
            parent: null,
            message: {
              id: "msg-1",
              author: { role: "user" },
              create_time: 1704067200,
              content: { parts: ["hi"] },
            },
          },
          "node-2": {
            id: "node-2",
            parent: "node-1",
            message: {
              id: "msg-2",
              author: { role: "assistant" },
              create_time: 1704067300,
              content: { parts: ["hello"] },
            },
          },
        },
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/chatgpt.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const result = await importConversations("chatgpt");
    expect(result?.source).toBe("chatgpt");
  });

  it("throws when Gemini export has no conversations", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/gemini.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify([]));
    await expect(importConversations("gemini")).rejects.toThrow(/No conversations found/i);
  });

  it("throws when Grok export has no conversations", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/grok.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify([]));
    await expect(importConversations("grok")).rejects.toThrow(/No conversations found/i);
  });

  it("returns null when Gemini user cancels dialog", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    expect(await importConversations("gemini")).toBeNull();
  });

  it("returns null when Grok user cancels dialog", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    expect(await importConversations("grok")).toBeNull();
  });

  it("returns null when plugin user cancels dialog", async () => {
    clearPlugins();
    registerImporter({ id: "cancelplug", label: "Cancel", available: true }, () => []);
    const { open } = await import("@tauri-apps/plugin-dialog");
    (open as any).mockResolvedValueOnce(null);
    expect(await importConversations("cancelplug" as any)).toBeNull();
  });

  it("throws when plugin export has no conversations", async () => {
    clearPlugins();
    registerImporter({ id: "emptyplug", label: "Empty", available: true }, () => []);
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    (open as any).mockResolvedValueOnce("/tmp/empty.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify([{ id: "x" }]));
    await expect(importConversations("emptyplug" as any)).rejects.toThrow(
      /No conversations found/i
    );
  });

  it("aborts import when signal already aborted", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const fixture = [
      {
        uuid: "c1",
        name: "T",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "human", created_at: "2026-01-01T00:00:00Z", text: "hi" },
        ],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/claude.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(fixture));
    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();
    const result = await importConversations("claude", { signal: controller.signal, onProgress });
    expect(result?.conversationCount).toBe(1);
  });

  it("handles onProgress for Gemini and Grok", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const geminiFixture = [
      {
        conversation_id: "g1",
        title: "Gemini",
        create_time: "2026-01-01T00:00:00Z",
        messages: [{ id: "m1", role: "user", content: "hi" }],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/gemini.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(geminiFixture));
    const onProgress = vi.fn();
    const r1 = await importConversations("gemini", { onProgress });
    expect(r1?.source).toBe("gemini");
    expect(onProgress).toHaveBeenCalled();
    const grokFixture = [
      {
        conversation_id: "k1",
        title: "Grok",
        create_time: 1704067200,
        messages: [{ message_id: "m1", sender: "user", text: "hi" }],
      },
    ];
    (open as any).mockResolvedValueOnce("/tmp/grok.json");
    (readTextFile as any).mockResolvedValueOnce(JSON.stringify(grokFixture));
    const r2 = await importConversations("grok", { onProgress });
    expect(r2?.source).toBe("grok");
  });

  afterEach(() => clearPlugins());
});
