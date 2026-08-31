import { describe, it, expect } from "vitest";
import {
  buildCountSql,
  buildFtsWhereClause,
  buildOrderBy,
  buildRankedRowsSql,
  buildSnippetWhereClause,
  buildTotalOccurrencesSql,
} from "./searchQueryBuilder";

describe("searchQueryBuilder", () => {
  describe("buildOrderBy", () => {
    it("defaults to last_occurrence DESC", () => {
      expect(buildOrderBy()).toBe("last_occurrence DESC, rank ASC");
      expect(buildOrderBy("last_occurrence_desc")).toBe("last_occurrence DESC, rank ASC");
    });
    it("maps relevance", () =>
      expect(buildOrderBy("relevance")).toBe("rank ASC, last_occurrence DESC"));
    it("maps occurrence_count_desc", () =>
      expect(buildOrderBy("occurrence_count_desc")).toBe("occurrence_count DESC, rank ASC"));
    it("maps title_az / title_za", () => {
      expect(buildOrderBy("title_az")).toBe("title COLLATE NOCASE ASC, rank ASC");
      expect(buildOrderBy("title_za")).toBe("title COLLATE NOCASE DESC, rank ASC");
    });
  });

  describe("buildFtsWhereClause", () => {
    it("base clause has 3 params", () => {
      const r = buildFtsWhereClause("hello", "hello", {});
      expect(r.whereClause).toBe("messages_fts MATCH $1");
      expect(r.params).toEqual(["hello", "%hello%", "hello"]);
    });
    it("adds source filter with sanitization", () => {
      const r = buildFtsWhereClause("hi", "hi", { source: "Claude" });
      expect(r.whereClause).toContain("c.source = $4");
      expect(r.params[3]).toBe("claude");
    });
    it("ignores invalid source", () => {
      const r = buildFtsWhereClause("hi", "hi", { source: "bad source!!" });
      expect(r.whereClause).not.toContain("c.source");
    });
    it("adds dateFrom/dateTo", () => {
      const r = buildFtsWhereClause("hi", "hi", {
        dateFrom: 100,
        dateTo: 200,
      });
      expect(r.whereClause).toContain(">= $4");
      expect(r.whereClause).toContain("<= $5");
      expect(r.params).toEqual(["hi", "%hi%", "hi", 100, 200]);
    });
    it("escapes like pattern in titleLikeParam", () => {
      const r = buildFtsWhereClause("a%b_c", "a%b_c", {});
      expect(r.titleLikeParam).toContain("\\%");
      expect(r.titleLikeParam).toContain("\\_");
    });
  });

  describe("buildSnippetWhereClause", () => {
    it("base snippet clause", () => {
      const r = buildSnippetWhereClause("hello", "c1", {});
      expect(r.whereClause).toBe("messages_fts MATCH $1 AND messages_fts.conversation_id = $2");
      expect(r.params).toEqual(["hello", "c1"]);
    });
    it("adds date filters", () => {
      const r = buildSnippetWhereClause("hello", "c1", {
        dateFrom: 10,
        dateTo: 20,
      });
      expect(r.whereClause).toContain(">= $3");
      expect(r.whereClause).toContain("<= $4");
      expect(r.params).toEqual(["hello", "c1", 10, 20]);
    });
  });

  describe("buildCountSql etc", () => {
    it("count sql embeds whereClause", () => {
      const sql = buildCountSql("messages_fts MATCH $1 AND c.source = $4");
      expect(sql).toContain("WHERE messages_fts MATCH");
      expect(sql).toContain("COUNT(DISTINCT");
    });
    it("totalOccurrences sql", () => {
      const sql = buildTotalOccurrencesSql("messages_fts MATCH $1");
      expect(sql).toContain("COALESCE");
    });
    it("rankedRows sql uses orderBy/limit/offset", () => {
      const sql = buildRankedRowsSql("messages_fts MATCH $1", "rank ASC", 20, 5);
      expect(sql).toContain("ORDER BY rank ASC");
      expect(sql).toContain("LIMIT 20 OFFSET 5");
    });
  });
});
