import { describe, it, expect } from "vitest";
import { parseGeminiConversations } from "./gemini.js";

describe("parseGeminiConversations", () => {
  it("parses valid Gemini export with single conversation", () => {
    const raw = [
      {
        conversation_id: "g1",
        title: "Gemini Chat",
        create_time: "2026-01-01T10:00:00Z",
        update_time: "2026-01-02T10:00:00Z",
        messages: [
          { id: "m1", role: "user", create_time: "2026-01-01T10:00:00Z", content: "Hello Gemini" },
          { id: "m2", role: "model", create_time: "2026-01-01T10:01:00Z", content: "Hi!" },
        ],
      },
    ];
    const result = parseGeminiConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("g1");
    expect(result[0].title).toBe("Gemini Chat");
    expect(result[0].source).toBe("gemini");
    expect(result[0].messageCount).toBe(2);
    expect(result[0].messages[0].sender).toBe("human");
    expect(result[0].messages[0].content).toBe("Hello Gemini");
    expect(result[0].messages[1].sender).toBe("assistant");
  });

  it("handles parts array and string content", () => {
    const raw = [
      {
        id: "g2",
        title: "Parts",
        create_time: 1704067200,
        messages: [
          { id: "m1", role: "user", content: { parts: ["Hello ", { text: "world" }] } },
          { id: "m2", role: "model", content: "Direct string" },
        ],
      },
    ];
    const result = parseGeminiConversations(raw);
    expect(result[0].messages[0].content).toBe("Hello\n\nworld");
    expect(result[0].messages[1].content).toBe("Direct string");
  });

  it("skips system and unknown roles", () => {
    const raw = [
      {
        conversation_id: "g3",
        title: "Roles",
        create_time: "2026-01-01T00:00:00Z",
        messages: [
          { id: "m1", role: "system", content: "ignore" },
          { id: "m2", role: "user", content: "keep" },
        ],
      },
    ];
    const result = parseGeminiConversations(raw);
    expect(result[0].messages).toHaveLength(1);
  });

  it("skips empty content", () => {
    const raw = [
      {
        conversation_id: "g4",
        messages: [
          { id: "m1", role: "user", content: "   " },
          { id: "m2", role: "user", content: "Valid" },
        ],
      },
    ];
    const result = parseGeminiConversations(raw);
    expect(result[0].messages).toHaveLength(1);
    expect(result[0].messages[0].content).toBe("Valid");
  });

  it("handles wrapped object with conversations key", () => {
    const raw = {
      conversations: [
        {
          conversation_id: "g5",
          title: "Wrapped",
          create_time: "2026-01-01T00:00:00Z",
          messages: [{ id: "m1", role: "user", content: "hi" }],
        },
      ],
    };
    const result = parseGeminiConversations(raw as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("g5");
  });

  it("defaults title to Untitled", () => {
    const raw = [
      { conversation_id: "g6", messages: [{ id: "m1", role: "user", content: "hi" }] },
    ] as any;
    const result = parseGeminiConversations(raw);
    expect(result[0].title).toBe("Untitled");
  });

  it("converts timestamps seconds to ms", () => {
    const raw = [
      {
        conversation_id: "g7",
        create_time: 1704067200,
        messages: [{ id: "m1", role: "user", content: "hi", create_time: 1704067200 }],
      },
    ] as any;
    const result = parseGeminiConversations(raw);
    expect(result[0].createdAt).toBe(1704067200 * 1000);
    expect(result[0].messages[0].createdAt).toBe(1704067200 * 1000);
  });

  it("handles empty input and invalid", () => {
    expect(parseGeminiConversations([])).toEqual([]);
    expect(parseGeminiConversations(null as any)).toEqual([]);
    expect(parseGeminiConversations({} as any)).toEqual([]);
  });

  it("skips missing id or messages", () => {
    const raw = [
      { title: "No id", messages: [{ id: "m1", role: "user", content: "hi" }] },
      { conversation_id: "ok", messages: [{ id: "m1", role: "user", content: "hi" }] },
    ] as any;
    const result = parseGeminiConversations(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ok");
  });
});
