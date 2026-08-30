import { describe, it, expect } from "vitest";
import { parseChatGPTConversations } from "./chatgpt.js";

describe("parseChatGPTConversations", () => {
  function buildChatGPTFixture(overrides: any = {}) {
    return [
      {
        id: "conv-1",
        title: "ChatGPT Test",
        create_time: 1704067200,
        update_time: 1704153600,
        current_node: "node-2",
        mapping: {
          "node-1": {
            id: "node-1",
            parent: null,
            message: {
              id: "msg-1",
              author: { role: "user" },
              create_time: 1704067200,
              content: { parts: ["Hello ChatGPT"] },
            },
          },
          "node-2": {
            id: "node-2",
            parent: "node-1",
            message: {
              id: "msg-2",
              author: { role: "assistant" },
              create_time: 1704067300,
              content: { parts: ["Hi there!"] },
            },
          },
        },
        ...overrides,
      },
    ];
  }

  it("parses valid ChatGPT export", () => {
    const raw = buildChatGPTFixture();
    const result = parseChatGPTConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conv-1");
    expect(result[0].title).toBe("ChatGPT Test");
    expect(result[0].source).toBe("chatgpt");
    expect(result[0].messageCount).toBe(2);
    expect(result[0].messages[0].sender).toBe("human");
    expect(result[0].messages[0].content).toBe("Hello ChatGPT");
    expect(result[0].messages[1].sender).toBe("assistant");
  });

  it("handles conversation_id fallback for id", () => {
    const raw = buildChatGPTFixture({ id: undefined, conversation_id: "fallback-id" });
    // need mapping to have convId
    raw[0].mapping["node-1"].message.id = "msg-1";
    const result = parseChatGPTConversations(raw);
    expect(result[0].id).toBe("fallback-id");
  });

  it("filters out conversations with zero messages", () => {
    const raw = [
      {
        id: "empty",
        title: "Empty",
        create_time: 1704067200,
        update_time: 1704067200,
        current_node: "missing",
        mapping: {},
      },
    ];
    const result = parseChatGPTConversations(raw as any);
    expect(result).toHaveLength(0);
  });

  it("skips non-user/assistant roles", () => {
    const raw = buildChatGPTFixture();
    raw[0].mapping["node-1"].message.author.role = "system";
    const result = parseChatGPTConversations(raw as any);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].sender).toBe("assistant");
  });

  it("handles missing mapping or current_node gracefully", () => {
    const raw = [{ id: "bad", title: "Bad" }] as any;
    expect(parseChatGPTConversations(raw)).toEqual([]);
  });

  it("handles empty parts array", () => {
    const raw = buildChatGPTFixture();
    raw[0].mapping["node-1"].message.content.parts = [];
    const result = parseChatGPTConversations(raw as any);
    expect(result[0].messages).toHaveLength(1); // only assistant remains
  });

  it("traverses linked list in correct order", () => {
    const raw = buildChatGPTFixture();
    const result = parseChatGPTConversations(raw);
    expect(result[0].messages[0].content).toBe("Hello ChatGPT");
    expect(result[0].messages[1].content).toBe("Hi there!");
  });

  it("converts timestamps from seconds to ms", () => {
    const raw = buildChatGPTFixture();
    const result = parseChatGPTConversations(raw);
    expect(result[0].createdAt).toBe(1704067200 * 1000);
    expect(result[0].updatedAt).toBe(1704153600 * 1000);
  });

  it("handles empty input", () => {
    expect(parseChatGPTConversations([])).toEqual([]);
  });
});
