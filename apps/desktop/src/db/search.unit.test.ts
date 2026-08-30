import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockDb = { select: mockSelect, execute: vi.fn() };

vi.mock("./connection", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../lib/vector", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...(actual as object),
    embed: vi.fn((t: string) => {
      // deterministic: vacation/holiday share similarity, else based on string
      if (t.toLowerCase().includes("vacation") || t.toLowerCase().includes("holiday")) return [1, 0, 0, 0];
      if (t.toLowerCase().includes("hello")) return [0.9, 0.1, 0, 0];
      return [0, 0, 1, 0];
    }),
    cosineSimilarity: vi.fn((a: number[], b: number[]) => {
      // dot product simple
      let dot = 0; for (let i=0;i<a.length;i++) dot+= (a[i]??0)*(b[i]??0);
      return dot;
    }),
  };
});

import { searchMessages } from "./search";

describe("db/search unit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
  });

  it("returns empty for blank query (early return)", async () => {
    const r = await searchMessages("   ");
    expect(r.rows).toEqual([]);
    expect(r.totalMatches).toBe(0);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty for non-token query (normalized empty)", async () => {
    const r = await searchMessages("***");
    expect(r.rows).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns empty for >500 length guard", async () => {
    const long = "a".repeat(501);
    const r = await searchMessages(long);
    expect(r.rows).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("semantic mode filters by similarity threshold and source/date", async () => {
    // Mock allRows for semantic path
    mockSelect.mockResolvedValueOnce([
      { message_id: "m1", conversation_id: "c1", content: "vacation planning", message_created_at: 100, title: "Trip", source: "claude", conv_created_at: 90 },
      { message_id: "m2", conversation_id: "c2", content: "unrelated random", message_created_at: 200, title: "Other", source: "chatgpt", conv_created_at: 180 },
      { message_id: "m3", conversation_id: "c1", content: "holiday getaway", message_created_at: 150, title: "Trip", source: "claude", conv_created_at: 90 },
    ]);
    const r = await searchMessages("vacation", { mode: "semantic", limit: 10 });
    // vacation should match m1 and m3 (both share vector), not m2
    expect(r.totalMatches).toBe(1); // only c1 grouped
    expect(r.rows[0].conversation_id).toBe("c1");
    expect(r.rows[0].occurrence_count).toBe(2);
  });

  it("semantic with source filter excludes non-matching source", async () => {
    mockSelect.mockResolvedValueOnce([
      { message_id: "m1", conversation_id: "c1", content: "vacation planning", message_created_at: 100, title: "Trip", source: "claude", conv_created_at: 90 },
      { message_id: "m2", conversation_id: "c2", content: "vacation planning", message_created_at: 100, title: "Trip2", source: "chatgpt", conv_created_at: 90 },
    ]);
    const r = await searchMessages("vacation", { mode: "semantic", source: "claude" });
    expect(r.totalMatches).toBe(1);
    expect(r.rows[0].source).toBe("claude");
  });

  it("semantic with dateFrom/dateTo filters", async () => {
    mockSelect.mockResolvedValueOnce([
      { message_id: "m1", conversation_id: "c1", content: "vacation", message_created_at: 50, title: "T", source: "claude", conv_created_at: 40 },
      { message_id: "m2", conversation_id: "c2", content: "vacation", message_created_at: 150, title: "T2", source: "claude", conv_created_at: 140 },
    ]);
    const r = await searchMessages("vacation", { mode: "semantic", dateFrom: 100, dateTo: 200 });
    expect(r.totalMatches).toBe(1);
    expect(r.rows[0].conversation_id).toBe("c2");
  });

  it("hybrid merges FTS + semantic (mocked)", async () => {
    // semantic allRows
    mockSelect.mockResolvedValueOnce([
      { message_id: "m1", conversation_id: "c1", content: "vacation", message_created_at: 100, title: "Trip", source: "claude", conv_created_at: 90 },
    ]);
    // For hybrid, runFtsSearch will be called internally and does 3 selects + snippets
    // Mock those: count, totalOcc, rawRows, plus snippetRows per conversation
    // We need to mock sequence after allRows:
    // 1) countSql, 2) totalOccSql, 3) rowsSql, 4) snippetRows for c1
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }]) // count
      .mockResolvedValueOnce([{ total: 2 }]) // totalOcc
      .mockResolvedValueOnce([ // rawRows
        { conversation_id: "c2", title: "FtsOnly", source: "claude", created_at: 80, last_occurrence: 110, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: "m9" },
      ])
      .mockResolvedValueOnce([{ snippet: "fts snippet <mark>vacation</mark>" }]); // snippet for c2

    const r = await searchMessages("vacation", { mode: "hybrid", limit: 10 });
    // Should have merged c1 (semantic) + c2 (fts) = 2 matches
    expect(r.totalMatches).toBe(2);
    expect(r.rows.some(rr => rr.conversation_id === "c1")).toBe(true);
    expect(r.rows.some(rr => rr.conversation_id === "c2")).toBe(true);
  });
});
