import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeQuery, withDbLock, searchMessages } from "./db";

// Mock the Database plugin before importing db module that uses it
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(async () => ({
      execute: vi.fn(async () => {}),
      select: vi.fn(async () => []),
    })),
  },
}));

describe("normalizeQuery", () => {
  it("lowercases and adds wildcard to single term", () => {
    expect(normalizeQuery("Hello")).toBe("hello*");
  });

  it("tokenizes multiple words", () => {
    expect(normalizeQuery("  Hello   World  ")).toBe("hello* world*");
  });

  it("strips trailing asterisks before re-adding", () => {
    expect(normalizeQuery("salary*")).toBe("salary*");
    expect(normalizeQuery("salary**")).toBe("salary*");
  });

  it("handles unicode letters and numbers", () => {
    expect(normalizeQuery("Café 123")).toBe("café* 123*");
  });

  it("ignores punctuation and returns empty for only symbols", () => {
    expect(normalizeQuery("!!! ???")).toBe("");
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });

  it("handles mixed punctuation inside query", () => {
    expect(normalizeQuery("hello, world!")).toBe("hello* world*");
  });

  it("is idempotent for already normalized query", () => {
    const first = normalizeQuery("test query");
    expect(normalizeQuery(first.replace(/\*/g, ""))).toBe(first);
  });
});

describe("withDbLock", () => {
  it("serializes concurrent operations in order", async () => {
    const order: number[] = [];
    const delays = [30, 10, 20];

    const tasks = delays.map((delay, idx) =>
      withDbLock(async () => {
        await new Promise((r) => setTimeout(r, delay));
        order.push(idx);
        return idx;
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2]);
    expect(order).toEqual([0, 1, 2]);
  });

  it("continues queue after a failing operation", async () => {
    const failing = withDbLock(async () => {
      throw new Error("boom");
    });

    const succeeding = withDbLock(async () => 42);

    await expect(failing).rejects.toThrow("boom");
    await expect(succeeding).resolves.toBe(42);
  });

  it("runs subsequent tasks even if previous rejects, preserving order", async () => {
    const log: string[] = [];

    const a = withDbLock(async () => {
      log.push("a-start");
      await new Promise((r) => setTimeout(r, 10));
      log.push("a-end");
      throw new Error("fail a");
    }).catch(() => log.push("a-caught"));

    const b = withDbLock(async () => {
      log.push("b");
      return "b";
    });

    const c = withDbLock(async () => {
      log.push("c");
      return "c";
    });

    await Promise.all([a, b, c]);
    expect(log).toEqual(["a-start", "a-end", "a-caught", "b", "c"]);
  });

  it("resolves with the return value of the callback", async () => {
    const result = await withDbLock(async () => "hello");
    expect(result).toBe("hello");
  });

  it("handles synchronous throw as rejection", async () => {
    await expect(
      withDbLock(async () => {
        throw new Error("sync fail");
      })
    ).rejects.toThrow("sync fail");

    // queue should still work
    await expect(withDbLock(async () => 1)).resolves.toBe(1);
  });
});

describe("searchMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result for empty query without hitting DB", async () => {
    const res = await searchMessages("   ");
    expect(res).toEqual({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  });

  it("returns empty result for punctuation-only query", async () => {
    const res = await searchMessages("!!! ???");
    expect(res).toEqual({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  });

  it("returns structured result for valid query (mocked DB returns empty)", async () => {
    const res = await searchMessages("hello world", { limit: 10, offset: 0 });
    expect(res).toHaveProperty("rows");
    expect(res).toHaveProperty("totalMatches");
    expect(res).toHaveProperty("totalOccurrences");
    expect(Array.isArray(res.rows)).toBe(true);
    expect(res.totalMatches).toBe(0);
  });

  it("respects limit and offset clamping via DB call (does not throw)", async () => {
    // limit 0 should be clamped to 1, NaN to default 20, offset negative to 0
    await expect(searchMessages("test", { limit: 0, offset: -5 })).resolves.toBeDefined();
    await expect(
      searchMessages("test", { limit: NaN as any, offset: NaN as any })
    ).resolves.toBeDefined();
    await expect(searchMessages("test", { limit: 1000, offset: 0 })).resolves.toBeDefined();
  });

  it("handles source filter without throwing", async () => {
    await expect(searchMessages("test", { source: "claude" })).resolves.toBeDefined();
  });

  it("handles all sort options without throwing", async () => {
    const sorts = [
      "relevance",
      "last_occurrence_desc",
      "occurrence_count_desc",
      "title_az",
      "title_za",
    ] as const;
    for (const sort of sorts) {
      await expect(searchMessages("test", { sort })).resolves.toBeDefined();
    }
  });
});
