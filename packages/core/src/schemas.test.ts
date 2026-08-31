import { describe, it, expect } from "vitest";
import { ImportValidationError, validateParsedConversations } from "./schemas.js";

describe("core schemas", () => {
  it("rejects non-array parsed", () => {
    expect(() => validateParsedConversations({} as unknown)).toThrow(ImportValidationError);
  });
  it("accepts custom source (plugin)", () => {
    const good = [
      {
        id: "c1",
        externalId: "c1",
        source: "custom",
        title: "t",
        createdAt: 0,
        updatedAt: 0,
        messageCount: 0,
        messages: [],
      },
    ];
    expect(() => validateParsedConversations(good as unknown)).not.toThrow();
  });
  it("rejects empty source", () => {
    const bad = [
      {
        id: "c1",
        externalId: "c1",
        source: "",
        title: "t",
        createdAt: 0,
        updatedAt: 0,
        messageCount: 0,
        messages: [],
      },
    ];
    expect(() => validateParsedConversations(bad as unknown)).toThrow();
  });
  it("accepts valid parsed", () => {
    const good = [
      {
        id: "c1",
        externalId: "c1",
        source: "claude",
        title: "Hi",
        createdAt: 0,
        updatedAt: 0,
        messageCount: 1,
        messages: [
          { id: "m1", conversationId: "c1", sender: "human", content: "hi", createdAt: 0 },
        ],
      },
    ];
    expect(() => validateParsedConversations(good)).not.toThrow();
  });
  it("rejects empty content", () => {
    const bad = [
      {
        id: "c1",
        externalId: "c1",
        source: "claude",
        title: "t",
        createdAt: 0,
        updatedAt: 0,
        messageCount: 1,
        messages: [{ id: "m1", conversationId: "c1", sender: "human", content: "", createdAt: 0 }],
      },
    ];
    expect(() => validateParsedConversations(bad as unknown)).toThrow();
  });
});
