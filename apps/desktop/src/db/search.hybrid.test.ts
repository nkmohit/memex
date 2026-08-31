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
      const l = t.toLowerCase();
      if (l.includes("vacation") || l.includes("holiday") || l.includes("trip"))
        return [1, 0, 0, 0];
      if (l.includes("react") || l.includes("frontend")) return [0, 1, 0, 0];
      return [0, 0, 1, 0];
    }),
    cosineSimilarity: vi.fn((a: number[], b: number[]) => {
      let dot = 0;
      for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
      return dot;
    }),
  };
});

import { searchMessages } from "./search";

describe("db/search hybrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
  });

  it("semantic finds paraphrase (vacation ↔ holiday)", async () => {
    mockSelect.mockResolvedValueOnce([
      {
        message_id: "m1",
        conversation_id: "c1",
        content: "holiday getaway planning",
        message_created_at: 100,
        title: "Trip",
        source: "claude",
        conv_created_at: 90,
      },
      {
        message_id: "m2",
        conversation_id: "c2",
        content: "unrelated random text about cooking",
        message_created_at: 200,
        title: "Other",
        source: "claude",
        conv_created_at: 180,
      },
    ]);
    const r = await searchMessages("vacation", { mode: "semantic" });
    expect(r.totalMatches).toBe(1);
    expect(r.rows[0].conversation_id).toBe("c1");
  });

  it("hybrid merges semantic + FTS (union, dedup, rank blend)", async () => {
    // semantic allRows
    mockSelect.mockResolvedValueOnce([
      {
        message_id: "m1",
        conversation_id: "c1",
        content: "vacation",
        message_created_at: 100,
        title: "Trip",
        source: "claude",
        conv_created_at: 90,
      },
    ]);
    // FTS path inside hybrid: count, totalOcc, rawRows, snippet for c2
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          conversation_id: "c2",
          title: "FtsOnly",
          source: "claude",
          created_at: 80,
          last_occurrence: 110,
          occurrence_count: 2,
          message_match_count: 1,
          rank: -2,
          first_match_message_id: "m9",
        },
      ])
      .mockResolvedValueOnce([{ snippet: "fts <mark>vacation</mark>" }]);

    const r = await searchMessages("vacation", { mode: "hybrid" });
    expect(r.totalMatches).toBe(2);
    expect(r.rows.map((x) => x.conversation_id).sort()).toEqual(["c1", "c2"]);
    // c1 from semantic has rank from vector (0), c2 from FTS has rank -2, sorted best first => c2 before c1
    expect(r.rows[0].conversation_id).toBe("c2");
  });

  it("hybrid with overlapping conversation blends rank", async () => {
    mockSelect.mockResolvedValueOnce([
      {
        message_id: "m1",
        conversation_id: "c1",
        content: "vacation",
        message_created_at: 100,
        title: "Trip",
        source: "claude",
        conv_created_at: 90,
      },
    ]);
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          conversation_id: "c1",
          title: "Trip",
          source: "claude",
          created_at: 90,
          last_occurrence: 100,
          occurrence_count: 3,
          message_match_count: 1,
          rank: -3,
          first_match_message_id: "m1",
        },
      ])
      .mockResolvedValueOnce([{ snippet: "overlap <mark>vacation</mark>" }]);

    const r = await searchMessages("vacation", { mode: "hybrid" });
    expect(r.totalMatches).toBe(1);
    // hybrid rank is (ftsRank + semRank)/2 = (-3 + 0)/2 = -1.5, should be between
    expect(r.rows[0].rank).toBeCloseTo(-1.5);
    expect(r.rows[0].occurrence_count).toBe(3); // max of semantic 1 and FTS 3
  });

  it("fts mode still works (baseline, no vector)", async () => {
    // mock FTS path directly: count, totalOcc, rawRows, snippet
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          conversation_id: "c1",
          title: "t",
          source: "claude",
          created_at: 0,
          last_occurrence: 10,
          occurrence_count: 1,
          message_match_count: 1,
          rank: -1,
          first_match_message_id: "m1",
        },
      ])
      .mockResolvedValueOnce([{ snippet: "<mark>hello</mark>" }]);

    const r = await searchMessages("hello", { mode: "fts" });
    expect(r.totalMatches).toBe(1);
    expect(r.rows[0].snippet).toContain("<mark>");
  });
});
