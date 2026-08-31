import { describe, it, expect } from "vitest";
import {
  ImportValidationError,
  ParsedConversationArraySchema,
  SearchOptionsSchema,
  validateClaudePayload,
  validateParsedConversations,
  validateSearchOptions,
} from "./schemas";

describe("schemas", () => {
  describe("ParsedConversationArraySchema", () => {
    it("rejects non-array", () => {
      expect(() => validateParsedConversations({} as unknown)).toThrow(ImportValidationError);
    });
    it("rejects missing id", () => {
      const bad = [
        {
          externalId: "x",
          source: "claude",
          title: "t",
          createdAt: 0,
          updatedAt: 0,
          messageCount: 0,
          messages: [],
        },
      ];
      expect(() => validateParsedConversations(bad as unknown)).toThrow(ImportValidationError);
    });
    it("rejects invalid source", () => {
      const bad = [
        {
          id: "c1",
          externalId: "c1",
          source: "unknown",
          title: "t",
          createdAt: 0,
          updatedAt: 0,
          messageCount: 0,
          messages: [],
        },
      ];
      expect(() => validateParsedConversations(bad as unknown)).toThrow();
    });
    it("accepts valid parsed conversation", () => {
      const good = [
        {
          id: "c1",
          externalId: "c1",
          source: "claude",
          title: "Hello",
          createdAt: 0,
          updatedAt: 0,
          messageCount: 1,
          messages: [
            { id: "c1_m1", conversationId: "c1", sender: "human", content: "hi", createdAt: 0 },
          ],
        },
      ];
      expect(() => validateParsedConversations(good)).not.toThrow();
      expect(ParsedConversationArraySchema.safeParse(good).success).toBe(true);
    });
    it("rejects message with empty content", () => {
      const bad = [
        {
          id: "c1",
          externalId: "c1",
          source: "claude",
          title: "t",
          createdAt: 0,
          updatedAt: 0,
          messageCount: 1,
          messages: [
            { id: "m1", conversationId: "c1", sender: "human", content: "", createdAt: 0 },
          ],
        },
      ];
      expect(() => validateParsedConversations(bad as unknown)).toThrow();
    });
  });

  describe("SearchOptionsSchema", () => {
    it("defaults sort and mode", () => {
      const v = validateSearchOptions({});
      expect(v.sort).toBe("last_occurrence_desc");
      expect(v.mode).toBe("fts");
    });
    it("sanitizes source via sanitizeSource", () => {
      const v = validateSearchOptions({ source: "CLAUDE" });
      expect(v.source).toBe("claude");
    });
    it("drops invalid source", () => {
      const v = validateSearchOptions({ source: "bad source!!" });
      expect(v.source).toBeUndefined();
    });
    it("clamps limit/offset", () => {
      const v = validateSearchOptions({ limit: 999, offset: -5 });
      expect(v.limit).toBe(100);
      expect(v.offset).toBe(0);
    });
    it("rejects invalid dateFrom", () => {
      expect(() => validateSearchOptions({ dateFrom: -1 })).toThrow();
    });
  });

  describe("Claude payload", () => {
    it("rejects non-array", () => {
      expect(() => validateClaudePayload({} as unknown)).toThrow(ImportValidationError);
    });
    it("rejects missing uuid", () => {
      expect(() => validateClaudePayload([{ name: "t", chat_messages: [] }] as unknown)).toThrow();
    });
    it("accepts valid claude array", () => {
      expect(() =>
        validateClaudePayload([
          { uuid: "u1", chat_messages: [{ uuid: "m1", sender: "human", text: "hi" }] },
        ])
      ).not.toThrow();
    });
  });

  describe("SearchOptionsSchema direct safeParse", () => {
    it("validates sort enum", () => {
      expect(SearchOptionsSchema.safeParse({ sort: "invalid" }).success).toBe(false);
      expect(SearchOptionsSchema.safeParse({ sort: "relevance" }).success).toBe(true);
    });
  });
});
