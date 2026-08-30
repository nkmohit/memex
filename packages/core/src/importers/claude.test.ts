import { describe, it, expect } from "vitest";
import { parseClaudeConversations } from "./claude.js";

describe("parseClaudeConversations", () => {
  it("parses valid Claude export with single conversation", () => {
    const raw = [
      {
        uuid: "conv-1",
        name: "Test Chat",
        created_at: "2026-01-01T10:00:00Z",
        updated_at: "2026-01-02T10:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "human", created_at: "2026-01-01T10:00:00Z", text: "Hello" },
          { uuid: "m2", sender: "assistant", created_at: "2026-01-01T10:01:00Z", text: "Hi!" },
        ],
      },
    ];
    const result = parseClaudeConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conv-1");
    expect(result[0].title).toBe("Test Chat");
    expect(result[0].source).toBe("claude");
    expect(result[0].messageCount).toBe(2);
    expect(result[0].messages[0].sender).toBe("human");
    expect(result[0].messages[0].content).toBe("Hello");
  });

  it("skips messages with non-text content and empty text", () => {
    const raw = [
      {
        uuid: "conv-2",
        name: "Empty",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "human", created_at: "2026-01-01T00:00:00Z", text: "   " },
          { uuid: "m2", sender: "assistant", created_at: "2026-01-01T00:01:00Z", content: [{ type: "image", url: "x" }] },
          { uuid: "m3", sender: "human", created_at: "2026-01-01T00:02:00Z", text: "Valid" },
        ],
      },
    ];
    const result = parseClaudeConversations(raw);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].content).toBe("Valid");
  });

  it("handles content blocks array with text types", () => {
    const raw = [
      {
        uuid: "conv-3",
        name: "Blocks",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        chat_messages: [
          {
            uuid: "m1",
            sender: "human",
            created_at: "2026-01-01T00:00:00Z",
            content: [
              { type: "text", text: "Hello " },
              { type: "text", text: "world" },
              { type: "tool", text: "ignore" },
            ],
          },
        ],
      },
    ];
    const result = parseClaudeConversations(raw);
    expect(result[0].messages[0].content).toBe("Hello\n\nworld");
  });

  it("skips conversations missing uuid or chat_messages", () => {
    const raw = [{ name: "No uuid", chat_messages: [] }, { uuid: "ok", name: "ok", chat_messages: [] }] as any;
    const result = parseClaudeConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ok");
  });

  it("skips messages with invalid sender", () => {
    const raw = [
      {
        uuid: "conv-4",
        name: "Test",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "system", created_at: "2026-01-01T00:00:00Z", text: "ignored" },
          { uuid: "m2", sender: "human", created_at: "2026-01-01T00:00:00Z", text: "kept" },
        ],
      },
    ];
    const result = parseClaudeConversations(raw);
    expect(result[0].messages).toHaveLength(1);
  });

  it("defaults title to Untitled when missing", () => {
    const raw = [{ uuid: "conv-5", chat_messages: [], created_at: "2026-01-01T00:00:00Z" }] as any;
    const result = parseClaudeConversations(raw);
    expect(result[0].title).toBe("Untitled");
  });

  it("converts timestamps to numbers", () => {
    const raw = [
      {
        uuid: "c1",
        name: "T",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "human", created_at: "2026-01-01T12:00:00Z", text: "Hi" },
        ],
      },
    ];
    const result = parseClaudeConversations(raw);
    expect(typeof result[0].createdAt).toBe("number");
    expect(result[0].createdAt).toBe(new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("handles empty input", () => {
    expect(parseClaudeConversations([])).toEqual([]);
    expect(parseClaudeConversations([null as any, undefined as any])).toEqual([]);
  });
});
