import { describe, it, expect } from "vitest";
import { parseGrokConversations } from "./grok.js";

describe("parseGrokConversations", () => {
  it("parses valid Grok export", () => {
    const raw = [
      {
        conversation_id: "k1",
        title: "Grok Chat",
        create_time: 1704067200,
        update_time: 1704153600,
        messages: [
          { message_id: "m1", sender: "user", create_time: 1704067200, text: "Hello Grok" },
          { message_id: "m2", sender: "assistant", create_time: 1704067300, text: "Hi!" },
        ],
      },
    ];
    const result = parseGrokConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("k1");
    expect(result[0].source).toBe("grok");
    expect(result[0].title).toBe("Grok Chat");
    expect(result[0].messageCount).toBe(2);
    expect(result[0].messages[0].sender).toBe("human");
    expect(result[0].messages[1].sender).toBe("assistant");
  });

  it("handles role variations and parts", () => {
    const raw = [
      {
        id: "k2",
        create_time: "2026-01-01T00:00:00Z",
        messages: [
          { id: "m1", role: "user", content: { parts: ["Hello "] } },
          { id: "m2", role: "grok", content: "Response" },
        ],
      },
    ];
    const result = parseGrokConversations(raw);
    expect(result[0].messages[0].content).toBe("Hello");
    expect(result[0].messages[1].sender).toBe("assistant");
  });

  it("skips system and empty content", () => {
    const raw = [
      {
        conversation_id: "k3",
        messages: [
          { message_id: "m1", sender: "system", text: "ignore" },
          { message_id: "m2", sender: "user", text: "   " },
          { message_id: "m3", sender: "user", text: "Keep" },
        ],
      },
    ];
    const result = parseGrokConversations(raw);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].content).toBe("Keep");
  });

  it("handles wrapped grok_conversations key", () => {
    const raw = {
      grok_conversations: [
        { conversation_id: "k4", messages: [{ message_id: "m1", sender: "user", text: "hi" }] },
      ],
    };
    const result = parseGrokConversations(raw as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("k4");
  });

  it("defaults title to Untitled", () => {
    const raw = [{ conversation_id: "k5", messages: [{ message_id: "m1", sender: "user", text: "hi" }] }] as any;
    const result = parseGrokConversations(raw);
    expect(result[0].title).toBe("Untitled");
  });

  it("converts timestamps", () => {
    const raw = [{ conversation_id: "k6", create_time: "2026-01-01T00:00:00Z", messages: [{ message_id: "m1", sender: "user", text: "hi", create_time: "2026-01-01T00:00:00Z" }] }] as any;
    const result = parseGrokConversations(raw);
    expect(result[0].createdAt).toBe(new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("handles empty and invalid", () => {
    expect(parseGrokConversations([])).toEqual([]);
    expect(parseGrokConversations(null as any)).toEqual([]);
    expect(parseGrokConversations({} as any)).toEqual([]);
  });

  it("skips missing id", () => {
    const raw = [{ title: "No id", messages: [{ message_id: "m1", sender: "user", text: "hi" }] }, { conversation_id: "ok", messages: [{ message_id: "m1", sender: "user", text: "hi" }] }] as any;
    const result = parseGrokConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ok");
  });
});
