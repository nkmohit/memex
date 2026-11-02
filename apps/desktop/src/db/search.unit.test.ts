import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockDb = { select: mockSelect, execute: vi.fn() };

vi.mock("./connection", () => ({
  getDb: vi.fn(async () => mockDb),
  withDbLock: (fn: () => Promise<unknown>) => fn(),
}));

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

  it("runs the FTS query and attaches snippets", async () => {
    mockSelect
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        {
          conversation_id: "c1",
          title: "Hello",
          source: "claude",
          created_at: 1,
          last_occurrence: 2,
          occurrence_count: 1,
          message_match_count: 1,
          rank: -1,
          first_match_message_id: "m1",
        },
      ])
      .mockResolvedValueOnce([{ snippet: "say <mark>hello</mark>" }]);

    const r = await searchMessages("hello", { limit: 10 });
    expect(r.totalMatches).toBe(1);
    expect(r.totalOccurrences).toBe(2);
    expect(r.rows[0]?.conversation_id).toBe("c1");
    expect(r.rows[0]?.snippet).toContain("hello");
    const firstSql = String(mockSelect.mock.calls[0]?.[0]);
    expect(firstSql).toContain("messages_fts");
  });
});
